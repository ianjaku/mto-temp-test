# Custom images

Currently we're using 3 custom build images in ci/cd process.

1. **bitbucket-alpine** used as main image for builting service images and creating build plan
2. **bitbucket-after-build usead** used as step image of the pipeline (e.g deploy, run tests etc.)
3. **ubuntu-devops for local** devops service

To build and push all images with desired tag you need to invoke (make use that you're logged in with azure cli **az login**):

```
TAG=node18 make all
```

For building individual image:

```
TAG=node18 make build_xxx
```

For pushing individual image:

```
TAG=node18 make build_xxx
```

When you not specify TAG it will be tagged with tag latest.