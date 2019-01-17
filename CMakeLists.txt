# Copyright (c) 2019 LG Electronics, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# SPDX-License-Identifier: Apache-2.0

cmake_minimum_required(VERSION 2.8.7)
project(com.webos.service.contextintentmgr NONE)

include(webOS/webOS)
webos_modules_init(1 0 0 QUALIFIER RC4)
webos_component(1 0 0)

set(INSTALL_DIR ${WEBOS_INSTALL_WEBOS_SERVICESDIR}/${CMAKE_PROJECT_NAME})
#install necessary files to destination directory
install(DIRECTORY . DESTINATION ${INSTALL_DIR}
        USE_SOURCE_PERMISSIONS
        PATTERN "*~" EXCLUDE
        PATTERN "CMake*" EXCLUDE
        PATTERN "BUILD*" EXCLUDE
        PATTERN "*~" EXCLUDE
        PATTERN "*.in" EXCLUDE
        PATTERN ".git" EXCLUDE
        PATTERN ".gitignore" EXCLUDE
        PATTERN ".project" EXCLUDE
        PATTERN ".settings" EXCLUDE
        PATTERN "files" EXCLUDE
        PATTERN "test" EXCLUDE
        PATTERN "tempdb" EXCLUDE
        PATTERN "*.qmlproject" EXCLUDE
        PATTERN "README.md" EXCLUDE)
install(DIRECTORY files/systemd/services/ DESTINATION /lib/systemd/system/)

webos_build_system_bus_files()
