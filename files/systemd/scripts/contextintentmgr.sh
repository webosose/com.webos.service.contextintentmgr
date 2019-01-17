#!/bin/sh
# @@@LICENSE
#
# Copyright (c) 2019 LG Electronics, Inc.
#
# Confidential computer software. Valid license from LG required for
# possession, use or copying. Consistent with FAR 12.211 and 12.212,
# Commercial Computer Software, Computer Software Documentation, and
# Technical Data for Commercial Items are licensed to the U.S. Government
# under vendor's standard commercial license.
#
# LICENSE@@@

# Set contextintentmgr flow path
export CIM_FLOW_PATH="/usr/palm/services/com.webos.service.contextintentmgr/.nodered"

# ensure that cim flow directories exist
mkdir -p ${CIM_FLOW_PATH}

# set directories permission
chown -R nobody:nogroup ${CIM_FLOW_PATH}