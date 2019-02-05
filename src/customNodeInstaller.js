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

const fs = require("fs-extra"),
    path = require("path");

let writeJSONToDiskSync = (path, JSONData) => {
    let fd;
    try {
        fs.outputJSONSync(path, JSONData);
        fd = fs.openSync(path, 'rs+');
        fs.fdatasyncSync(fd);
        return true;
    } catch (e) {
        console.log("Exception in writing file",e);
        return false;
    }
};

let addToPackage = (details) => {
    console.log("addToPackage");
    return new Promise((resolve, reject) => {
        readCustomNodeDir(details)
            .then(readPackageJson)
            .then(nodePackageEntry)
            .then(writePackageJson)
            .then(moveCustomNodes)
            .then((details) => {
                resolve(details);
            })
            .catch((err) => {
                reject(err);
            })
    });
}
let removeFromPackage = (details) => {
    console.log("removeFromPackage");
    return new Promise((resolve, reject) => {
        if (details.nodeNames) {
            readPackageJson(details)
                .then(nodePackageRemove)
                .then(writePackageJson)
                .then(removeCustomNodes)
                .then((details) => {
                    resolve(details);
                })
                .catch((err) => {
                    reject(err);
                })
        } else {
            console.log("Node Names does not exists");
            resolve(details);
        }
    });

}
let readCustomNodeDir = (details) => {
    console.log("readCustomNodeDir");
    return new Promise((resolve, reject) => {
        let result = getLocalNodeFiles(details.customNodeDir);
        if (typeof result == "object") {
            details.customNodes = result;
            resolve(details);
        } else {
            reject(result);
        }
    })
}
let readPackageJson = (details) => {
    console.log("readPackageJson");
    return new Promise((resolve, reject) => {
        details.packagePath = path.join(details.userDir, "package.json");
        details.nodePackage = fs.readJsonSync(details.packagePath);
        resolve(details);
    })
}

let nodePackageEntry = (details) => {
    console.log("nodePackageEntry");
    return new Promise((resolve, reject) => {
        details.nodeNames = [];
        details.customNodes.forEach((nodes) => {
            if (details.nodePackage.dependencies.hasOwnProperty(nodes.name)) {
                reject("Error: Custom node name already registered, please re-install application with a different custom node name.");
            } else {
                details.nodeNames.push(nodes.name);
                details.nodePackage.dependencies[nodes.name] = path.join("./node_modules", nodes.name);
            }
        });
        resolve(details);
    })
}

let nodePackageRemove = (details) => {
    console.log("nodePackageRemove");
    return new Promise((resolve, reject) => {
        details.nodeNames.forEach((node) => {
            console.log(node);
            delete details.nodePackage.dependencies[node];
        });
        resolve(details);
    })
}

let writePackageJson = (details) => {
    console.log("writePackageJson");
    return new Promise((resolve, reject) => {
        if (writeJSONToDiskSync(details.packagePath, details.nodePackage)) {
            resolve(details);
        } else {
            reject("Error : Failed to recreate a package.json.");
        }
    })
}
let moveCustomNodes = (details) => {
    console.log("moveCustomNodes");
    return new Promise((resolve, reject) => {
        details.customNodes.forEach((nodes) => {
            fs.move(nodes.path, path.join(details.userDir, "node_modules", nodes.name), err => {
                if (err) {
                    console.log(err);
                    reject("Error : Moving Custom Node failed for " + nodes.name);
                }
            });
        });
        resolve(details);
    })
}
let removeCustomNodes = (details) => {
    console.log("removeCustomNodes");
    return new Promise((resolve, reject) => {
        details.nodeNames.forEach((node) => {
            fs.removeSync(path.join(details.userDir, "node_modules", node));
        });
        resolve(details);
    });
}

let getLocalNodeFiles = (dir) => {
    console.log("getLocalNodeFiles");
    let result = [];
    let files = [];
    try {
        files = fs.readdirSync(dir);
    } catch (err) {
        console.log(err);
        return "Error: Reading App Custom node directory failed.";
    }
    files.sort();
    files.forEach((fn) => {
        let stats = fs.statSync(path.join(dir, fn));
        if (stats.isFile()) {
            if (/\.js$/.test(fn)) {
                let info = getLocalFile(dir, fn);
                if (info) {
                    result.push(info);
                } else {
                    result = "Error : Reading package.json failed for " + path.join(dir, fn);
                }
            }
        } else if (stats.isDirectory()) {
            // Ignore /.dirs/, /lib/ /node_modules/
            if (!/^(\..*|lib|icons|node_modules|test|locales)$/.test(fn)) {
                chainVal = getLocalNodeFiles(path.join(dir, fn))
                if (typeof chainVal == "object") {
                    result = result.concat(chainVal);
                } else {
                    result = chainVal;
                }
            }
        }
    });
    return result;
}
let getLocalFile = (dir, fn) => {
    let file = path.join(dir, fn);
    try {
        let packageFile = fs.readJsonSync(path.join(dir, "package.json"));
        fs.statSync(file.replace(/\.js$/, ".html"));
        return {
            path: dir,
            name: packageFile.name
        };
    } catch (err) {
        console.log(err);
        return null;
    }
}
module.exports = {
    addToPackage: addToPackage,
    removeFromPackage: removeFromPackage
}