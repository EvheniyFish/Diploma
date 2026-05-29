#!/bin/sh
set -e

node src/db/seed.js
exec "$@"
