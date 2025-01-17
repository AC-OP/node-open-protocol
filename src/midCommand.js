module.exports = /** @type {const} */ ({
    "communicationStop":{
        "request": 3
    },
    "selectPset": {
        "request": 18
    },
    "setPsetBatchSize": {
        "request": 19
    },
    "resetPsetBatchCounter": {
        "request": 20
    },
    "parameterUserSetDownload": {
        "request": 25
    },
    "selectJob": {
        "request": 38
    },
    "jobRestart": {
        "request": 39
    },
    "disableTool": {
        "request": 42
    },
    "enableTool": {
        "request": 43
    },
    "disconnectTool": {
        "request": 44
    },
    "setCalibrationValue": {
        "request": 45
    },
    "setPrimaryTool": {
        "request": 46
    },
    "toolPairingHandling": {
        "request": 47
    },
    "vinDownload": {
        "request": 50
    },
    "setTime": {
        "request": 82
    },
    "displayUserTextOnCompact": {
        "request": 110
    },
    "displayUserTextOnGraph": {
        "request": 111
    },
    "flashGreenLightOnTool": {
        "request": 113
    },
    "abortJob": {
        "request": 127
    },
    "jobBatchIncrement": {
        "request": 128
    },
    "jobBatchDecrement": {
        "request": 129
    },
    "jobOff": {
        "request": 130
    },
    "setJobLineControlStart": {
        "request": 131
    },
    "setJobLineAlert1": {
        "request": 132
    },
    "setJobLineAlert2": {
        "request": 133
    },
    "executeDynamicJob": {
        "request": 140
    },
    "identifierDownload": {
        "request": 150
    },
    "bypassIdentifier": {
        "request": 155
    },
    "resetLatestIdentifier": {
        "request": 156
    },
    "resetAllIdentifiers": {
        "request": 157
    },
    "setExternallyControlledRelays": {
        "request": 200
    },
    "setDigitalInputFunction": {
        "request": 224
    },
    "resetDigitalInputFunction": {
        "request": 225
    },    
    "userDataDownload": {
        "request": 240,
        "reply": 242
    },
    "userDataDownloadWithOffset": {
        "request": 245
    },
    "selectorControlGreenLights": {
        "request": 254
    },
    "selectorControlRedLights": {
        "request": 255
    },
    "controllerReboot": {
        "request": 270
    },
    "motorTuning": {
        "request": 504
    },
    "deviceCommand": {
        "request": 2100
    },
    "passwordRequest": {
        "request": 2502
    },
    "passwordResponse": {
        "request": 2503
    },
    "selectParameterSetDynamically": {
        "request": 2505
    },
    "selectMode": {
        "request": 2606
    }
});
