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

var util = require('util');

var pmloglib;
var logContext;

function Logger(context) {
    try {
        pmloglib = require('pmloglib');
        logContext = new pmloglib.Context(context);
        console.log("created pmloglib's Context with " + context);
    } catch (e) {
        console.log("pmloglib not available; using console");
    }
    return;
};

function buildLogMessage(id, message, props) {
    return id + ": " + message + (props ? (" " + util.inspect(props)) : "");
}

function errorAsObject(err) {
    return {
        name: err.name,
        message: err.message,
        stack: err.stack
    };
}

function adaptProps(props) {
    if (props && props instanceof Function) {
        try {
            var f = props;
            props = f();
        } catch (e) {
            console.error("error in logging: " + e + ": " + e.stack);
            props = null;
        }
    }

    if (props && props instanceof Error) {
        var err = props;
        return errorAsObject(err);
    }

    if (props && Object.prototype.toString.call(props) !== '[object Object]') {
        props = {
            value: props.toString()
        };
    }

    return props;
};

function makeLogFunc(contextLevelName, consoleFuncName) {
    var logToConsole = function (id, message, props) {
        var props = adaptProps(props);
        var text = (id ? (id + ": ") : "") + message + (props ? (" " + util.inspect(props)) : "");
        console[consoleFuncName](text);
    };

    var f = function (id, message, props) {
        if (logContext) {
            var level = pmloglib[contextLevelName];
            var props = adaptProps(props);
            logContext.log(level, id, props, message);
        }
        // Also log to console since pmlog usually won't
        logToConsole(id, message, props);
    };

    return f;
};

Logger.prototype.critical = makeLogFunc("LOG_CRITICAL", "error");
Logger.prototype.error = makeLogFunc("LOG_ERR", "error");
Logger.prototype.warning = makeLogFunc("LOG_WARNING", "warn");
Logger.prototype.info = makeLogFunc("LOG_INFO", "info");

Logger.prototype.debug = function (message, props) {
    props = adaptProps(props);

    if (props) {
        message = message + " " + util.inspect(props);
    }

    if (logContext) {
        logContext.log(pmloglib.LOG_DEBUG, message);
        // also log to console for debugging purposes
        console.info(message);
    } else {
        console.info(message);
    }
};

module.exports.Logger = Logger;
module.exports.errorAsObject = errorAsObject;