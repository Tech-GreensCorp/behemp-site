#!/bin/bash
git branch --show-current
git -c credential.helper= push origin feature/fases-1-2-4:main --force > /tmp/force_push.log 2>&1
