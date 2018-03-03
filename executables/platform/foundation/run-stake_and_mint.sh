#!/bin/bash

NODE_EXEC=$(which node);
$NODE_EXEC  ./node_modules/@openstfoundation/openst-platform/executables/inter_comm/stake_and_mint.js $1;
