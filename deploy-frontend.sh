#!/bin/bash
set -e  # stop immediately if any step fails, rather than deploying a broken build

BUCKET="skillmatch-frontend-ayushman"
REGION="ap-south-1"

echo "Building frontend..."
cd client
npm run build

echo "Syncing to S3..."
# --delete removes files in the bucket that no longer exist in build/ —
# this is what replaces the old "select everything, delete, re-upload" dance.
# Only changed/new files actually get uploaded, so repeat deploys are fast.
aws s3 sync build/ "s3://$BUCKET" --region "$REGION" --delete

echo ""
echo "Done. Live at:"
echo "http://$BUCKET.s3-website.$REGION.amazonaws.com"
live url : "http://skillmatch-frontend-ayushman.s3-website.ap-south-1.amazonaws.com/"