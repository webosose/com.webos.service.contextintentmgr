// Copyright (c) 2019 LG Electronics, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

var deviceAction = {};
function voiceRawDataHandler(enginePayload) {
    var response = {},
        returnObj = {
            "voice": undefined
        };
    function parseData(voiceResponse) {
        let voiceObj = {};
        if (voiceResponse.hasOwnProperty("keywordDetected")) {
            deviceAction = {};
            voiceObj.intent = "listening";
            voiceObj.entity = {
                "ttsResponse": "Engine listening..."
            };
            return voiceObj;
        } else if (voiceResponse.hasOwnProperty("deviceAction")) {
            let paylpad = voiceResponse.deviceAction.inputs[0].payload;
            deviceAction.intent = paylpad.commands[0].execution[0].command;
            deviceAction.entity = paylpad.commands[0].execution[0].params;
        } else if (voiceResponse.hasOwnProperty("displayText")) {
            let displayText = voiceResponse.displayText;
            if (displayText == "") {
                deviceAction = {};
                voiceObj.intent = "unknown";
                voiceObj.entity = {
                    "ttsResponse": "Unknown or unsupported intend."
                };
                return voiceObj;
            }
            if (deviceAction.hasOwnProperty("intent")) {
                deviceAction.entity.ttsResponse = displayText;
                return deviceAction;
            } else {
                voiceObj.intent = "simpleQuery";
                voiceObj.entity = {
                    "ttsResponse": displayText
                };
                return voiceObj;
            }
        } else {
            return false;
        }
    }
    response = enginePayload.response;
    returnObj.voice = parseData(response);
    return returnObj;
}

module.exports = {
    voice: voiceRawDataHandler
};