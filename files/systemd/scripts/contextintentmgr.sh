#!/bin/sh
# Copyright (c) 2019 LG Electronics, Inc.

# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at

# http://www.apache.org/licenses/LICENSE-2.0

# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# SPDX-License-Identifier: Apache-2.0

# Set contextintentmgr flow path
export CIM_FLOW_PATH="/usr/palm/services/com.webos.service.contextintentmgr/.nodered"

if [ "$(stat -c "%U %G" ${CIM_FLOW_PATH})" != "nobody nogroup" ]
then
    # ensure that cim flow directories exist
    mkdir -p ${CIM_FLOW_PATH}
    # set directories permission
    chown -R nobody:nogroup ${CIM_FLOW_PATH}
fi