## Description

- This is the 'API Gateway' microservice, its responsibilities will be:

  1. Combine different **grpc services**, and then expose as real public APIs.

  2. Block and reject dirty requests.

## Note

1. Any new created branch please indicate its 'target' and 'based point' in the branch name explicitly.

## How to build this image, and then push to our private registry.

  ```
  # Build your image.
  docker build \
    --no-cache=true \
    --pull=true \
    --compress=false \
    --rm=true \
    --force-rm=true \
    --tag gateway-dev-leonard:0.0.1 \
    .

  # Tag your image.
  docker tag gateway-dev-leonard:0.0.1 micro02.sgdev.vcube.com:65300/gateway-dev-leonard:0.0.1

  # Login to the corresponding registry.
  docker login micro02.sgdev.vcube.com:65300

  # Push your image to the registry.
  docker push micro02.sgdev.vcube.com:65300/gateway-dev-leonard:0.0.1

  # Trigger running container update.
  docker service update --image micro02.sgdev.vcube.com:65300/gateway-dev-leonard:0.0.3 gate_services_stack_ms_ms-gateway
  ```


