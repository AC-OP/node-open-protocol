/*
   Copyright 2018 Smart-Tech Controle e Automação

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
"use strict";
/*jshint esversion: 6, node: true*/

const {
    Duplex
} = require("stream");

const OpenProtocolParser = require("./openProtocolParser");
const OpenProtocolSerializer = require("./openProtocolSerializer");
const MIDParser = require("./MIDParser");
const MIDSerializer = require("./MIDSerializer");
const constants = require("./constants.json");

const POSITIVE_ACK = 9997;
const NEGATIVE_ACK = 9998;

/**
 * This class is responsible for the controller of the link layer of OpenProtocol
 */
class LinkLayer extends Duplex {

    /**
     * Create a new object LinkLayer
     * @throws {error}
     * @param {object} opts
     * @param {stream} opts.stream
     * @param {number} opts.timeOut
     * @param {number} opts.retryTimes
     * @param {boolean} opts.rawData
     * @param {boolean} opts.disableMidParsing
     */
    constructor(opts) {

        opts = opts || {};
        opts.readableObjectMode = true;
        opts.writableObjectMode = true;

        super(opts);

        if (opts.stream === undefined) {
            throw new Error("[LinkLayer] Socket is undefined");
        }

        //Create instances of manipulators
        this.opParser = new OpenProtocolParser();
        this.opSerializer = new OpenProtocolSerializer();
        this.midParser = new MIDParser();
        this.midSerializer = new MIDSerializer();
        //Create instances of manipulators

        this.stream = opts.stream;
        this.timeOut = opts.timeOut || 3000;
        this.retryTimes = opts.retryTimes || 3;

        //Raw Data
        this.rawData = opts.rawData || false;

        //Disable MID Parsing
        this.disableMidParsing = opts.disableMidParsing || {};

        this.linkLayerActive = false;
        this.partsOfMessage = [];
        this.receiverMessageInParts = 0;
        this.numberMessageReceived = 1;

        this.lastMessageReceived = {
            mid: 0,
            sequenceNumber: 0
        };

        this.stream.pause();

        //Errors
        this.midSerializer.on("error", (err) => this._onErrorSerializer(err));
        this.opSerializer.on("error", (err) => this._onErrorSerializer(err));

        //TODO
        //Verificar outra tratativa
        this.opParser.on("error", (err) => this._onErrorParser(err));
        this.midParser.on("error", (err) => this._onErrorParser(err));
        //Errors

        //SEND DATA
        this.midSerializer.on("data", (data) => this._onDataMidSerializer(data));
        this.opSerializer.on("data", (data) => this._onDataOpSerializer(data));
        //SEND DATA

        //RECEIVER DATA
        this.stream.on("data", (data) => this._onDataStream(data));
        this.opParser.on("data", (data) => this._onDataOpParser(data));
        this.midParser.on("data", (data) => this._onDataMidParser(data));
        //RECEIVER DATA
    }

    _onErrorSerializer(err) {

        if (this.linkLayerActive) {
            this.sequenceNumber--;
        }

        if (this.callbackWrite) {
            function doCallback(cb) {
                process.nextTick(() => cb());
            }

            doCallback(this.callbackWrite);

            this.callbackWrite = undefined;
        }

        this.emit("errorSerializer", err);

        return;
    }

    _onErrorParser(err) {
        this.emit("error", err);
        return;
    }

    _onDataMidSerializer(data) {

        if (data.mid !== NEGATIVE_ACK && data.mid !== POSITIVE_ACK) {
            clearTimeout(this.timer);
            this.timer = setTimeout(() => this._resendMid(), this.timeOut);
        }

        this.messageParts = 0;
        let length = data.payload.length;

        //Multi Parts           
        if (length > 9979) {
            let msgPart = 1;
            let parts = length / 9979;
            parts = Math.ceil(parts);
            data.messageParts = parts;
            this.messageParts = parts;

            if (parts > 9) {
                this.emit("error", new Error(`[LinkLayer] number of messages > 9, MID[${data.mid}], length buffer [${length}]`));
                return;
            }

            let fullPayload = data.payload;

            while (fullPayload.length > 0) {

                if (fullPayload.length > 9979) {
                    data.payload = fullPayload.slice(0, 9979);
                    fullPayload = fullPayload.slice(9979);
                } else {
                    data.payload = fullPayload;
                    fullPayload = Buffer.from("");
                }

                data.messageNumber = msgPart;
                msgPart += 1;

                this.message = data;
                this.opSerializer.write(data);
            }

            return;
        }

        if (data.mid !== POSITIVE_ACK && data.mid !== NEGATIVE_ACK) {
            this.message = data;
        }

        this.opSerializer.write(data);
    }

    _onDataOpSerializer(data) {
        this.stream.write(data);
    }

    _onDataStream(data) {
        if (this.rawData) {
            this.dataRaw = Buffer.from(data);
        }

        this.opParser.write(data);
    }

    _onDataOpParser(data) {

        let duplicateMsg = false;

        if (this.linkLayerActive) {
            if (this.lastMessageReceived.mid === data.mid && this.lastMessageReceived.sequenceNumber === data.sequenceNumber) {
                duplicateMsg = true;
                this.sequenceNumberPartner -= 1;
            }
        }

        if (data.messageParts !== 0 || this.receiverMessageInParts !== 0) {

            this.receiverMessageInParts = data.messageParts;

            if (data.messageNumber !== this.numberMessageReceived) {

                if (this.linkLayerActive) {
                    this._sendLinkLayer(NEGATIVE_ACK, data.sequenceNumber, {
                        midNumber: data.mid,
                        errorCode: constants.ERROR_LINKLAYER.INCONSISTENCY_MESSAGE_NUMBER
                    });
                }

                this.emit("error", new Error(`[LinkLayer] inconsistency message number, MID[${data.mid}]`));

                return;
            }

            this.partsOfMessage.push(data.payload);

            if (this.receiverMessageInParts === this.numberMessageReceived) {
                data.payload = Buffer.concat(this.partsOfMessage);
                this.receiverMessageInParts = 0;
                this.numberMessageReceived = 1;
                this.lastMessageReceived = data;

                if (!duplicateMsg) {

                    if (this.disableMidParsing[data.mid] && (data.mid !== POSITIVE_ACK && data.mid !== NEGATIVE_ACK)) {

                        if (this.rawData) {
                            data._raw = Buffer.from(this.dataRaw);
                        }

                        if (!this.push(data)) {
                            this.stream.pause();
                            return;
                        }
                    } else {
                        this.midParser.write(data);
                    }
                }
                return;
            }
            this.numberMessageReceived += 1;
            return;
        }

        if (this.linkLayerActive) {
            if (data.sequenceNumber !== 0) {
                if (data.mid === POSITIVE_ACK || data.mid === NEGATIVE_ACK) {
                    if (data.sequenceNumber !== (this.sequenceNumber)) {
                        this.emit("error", new Error(`[LinkLayer] sequence number invalid, MID[${data.mid}], received[${data.sequenceNumber}], expected[${this.sequenceNumber}]`));
                        return;
                    }
                } else {

                    if (this.sequenceNumberPartner) {
                        if (this.sequenceNumberPartner === 99) {
                            this.sequenceNumberPartner = 0;
                        }

                        if (data.sequenceNumber !== (this.sequenceNumberPartner + 1)) {
                            this._sendLinkLayer(NEGATIVE_ACK, data.sequenceNumber, {
                                midNumber: data.mid,
                                errorCode: constants.ERROR_LINKLAYER.INVALID_SEQUENCE_NUMBER
                            });

                            this.emit("error", new Error(`[LinkLayer] sequence number invalid, MID[${data.mid}]`));
                            return;
                        }
                    }

                    this.sequenceNumberPartner = data.sequenceNumber;
                    this._sendLinkLayer(POSITIVE_ACK, data.sequenceNumber, {
                        midNumber: data.mid
                    });
                }
            }
        }

        this.lastMessageReceived = data;

        if (!duplicateMsg) {
            if (this.disableMidParsing[data.mid] && (data.mid !== POSITIVE_ACK && data.mid !== NEGATIVE_ACK)) {
                if (this.rawData) {
                    data._raw = Buffer.from(this.dataRaw);
                }

                if (!this.push(data)) {
                    this.stream.pause();
                    return;
                }
            } else {
                this.midParser.write(data);
            }

        }
    }

    _onDataMidParser(data) {

        clearTimeout(this.timer);

        if (data.mid === POSITIVE_ACK || data.mid === NEGATIVE_ACK) {
            this._receiverLinkLayer(data);
            return;
        }

        if (this.rawData) {
            data._raw = Buffer.from(this.dataRaw);
        }

        if (!this.push(data)) {
            this.stream.pause();
            return;
        }
    }

    _write(msg, encoding, callback) {

        this.callbackWrite = callback;
        this.resentTimes = 0;

        if (this.linkLayerActive) {
            msg.sequenceNumber = this.sequenceNumber;
            this.sequenceNumber += 1;

            if (this.sequenceNumber > 99) {
                this.sequenceNumber = 1;
            }
        }

        this.midSerializer.write(msg);
    }

    _read(size) {
        if (this.stream.isPaused()) {
            this.stream.resume();
        }
    }

    _destroy() {
        clearTimeout(this.timer);
        this.opParser.destroy();
        this.opSerializer.destroy();
        this.midParser.destroy();
        this.midSerializer.destroy();
    }

    finishCycle(err) {

        if (this.callbackWrite) {
            this.callbackWrite(err);
            this.callbackWrite = undefined;
        }
    }

    /**
     * Enable LinkLayer
     */
    activateLinkLayer() {
        this.linkLayerActive = true;
        this.sequenceNumber = 1;
    }

    /**
     * Disable LinkLayer
     */
    deactivateLinkLayer() {
        this.linkLayerActive = false;
        clearTimeout(this.timer);
    }

    /**
     * @private
     * @param {*} data
     */
    _receiverLinkLayer(data) {

        clearTimeout(this.timer);

        if (data.mid === NEGATIVE_ACK || data.payload.midNumber !== this.message.mid || data.sequenceNumber !== this.sequenceNumber) {

            let err = new Error(`incorrect fields of MID, MID[${data.payload.midNumber}] - Error code [${data.payload.errorCode}] -` +
                ` Expect MID[${this.message.mid}] - Expect SequenceNumber [${this.sequenceNumber}] - Current SequenceNumber [${data.sequenceNumber}]`);

            if (this.callbackWrite) {

                function doCallback(cb, err) {
                    process.nextTick(() => cb(err));
                }

                doCallback(this.callbackWrite, err);

                this.callbackWrite = undefined;

            } else {
                this.emit("error", err);
            }
            return;
        }

        this.message = {};

        if (this.callbackWrite) {

            function doCallback(cb) {
                process.nextTick(() => cb());
            }

            doCallback(this.callbackWrite);

            this.callbackWrite = undefined;
        }
    }

    /**
     * @private
     * @param {*} mid
     * @param {*} sequenceNumber
     * @param {*} payload
     */
    _sendLinkLayer(mid, sequenceNumber, payload) {

        if (sequenceNumber === 99) {
            sequenceNumber = 0;
        }

        let msg = {
            mid: mid,
            sequenceNumber: (sequenceNumber + 1),
            payload
        };

        this.midSerializer.write(msg);
    }

    /**
     * @private
     */
    _resendMid() {

        clearTimeout(this.timer);

        if (this.resentTimes < this.retryTimes) {
            this.timer = setTimeout(() => this._resendMid(), this.timeOut);
            this.opSerializer.write(this.message);
            this.resentTimes += 1;

        } else {

            let err = new Error(`[LinkLayer] timeout send MID[${this.message.mid}]`);

            this.resentTimes = 0;

            if (this.callbackWrite) {

                function doCallback(cb, err) {
                    process.nextTick(() => cb(err));
                }

                doCallback(this.callbackWrite, err);

                this.callbackWrite = undefined;

            } else {
                this.emit("error", err);
            }
        }
    }
}

module.exports = LinkLayer;