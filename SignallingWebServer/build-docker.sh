#!/bin/sh
UTCNOW="$(date --utc +%Y%m%d%H%M%S)"
IMAGEID="gcr.io/ngp-odyssey/signallingwebserver:5.2-$UTCNOW"
docker build -f ./Dockerfile ../ -t "$IMAGEID" \
    && docker push "$IMAGEID" \
;
