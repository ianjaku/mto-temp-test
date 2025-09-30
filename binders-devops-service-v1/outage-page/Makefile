build:
	zip -r website-content.zip index.html assets/

upload: build
	aws s3 cp website-content.zip s3://manualto-deployment-bucket/website-content.zip

package: upload
	aws cloudformation package \
	--template-file template.yaml \
	--s3-bucket manualto-deployment-bucket \
	--output-template-file packaged-template.yaml \
	--region eu-central-1


deploy: package
	aws cloudformation deploy \
	--template-file packaged-template.yaml \
	--stack-name outage-page-stack \
	--capabilities CAPABILITY_IAM \
	--region eu-central-1

update-website:
	aws s3 cp index.html s3://manualto-prod-down/index.html
	aws s3 cp assets s3://manualto-prod-down/assets --recursive
