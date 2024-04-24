# How to perform initial setup of Cloud Run

Several APIs need to be setup for us to deploy to Cloud Run.
Luckily the `gcloud` cli can do most for us, so we run it once from a dev machine with sufficient credentials.
Subsequent deploys can happen via Github Actions. First [ensure the required APIs are enabled](https://cloud.google.com/build/docs/deploying-builds/deploy-cloud-run#before_you_begin)

```
gcloud config configurations list  # check that correct account and project are active
gcloud run deploy 								 # follow the interactive prompts to do the initial deploy
```

- allow unauthenticated invocations: YES
- enable all APIs it asks you for
- `member-number-lookup` is a decent service name
- select `europe-west2` since this is where other Makespace infrastructure is hosted (for GDPR reasons)

Needed to [enable the Artifact Registry service](https://cloud.google.com/artifact-registry/docs/enable-service):

```
gcloud services enable artifactregistry.googleapis.com
```

## Service accounts and IAM

Two service accounts (SA) are needed:

- one for Github Actions to use to do the build and deploy
- one for the Cloud Run instance to use

```
gcloud iam service-accounts create cloud-run-manager --display-name "Used for building and deploying to cloud run"
gcloud iam service-accounts list  # determine the SAs email address
gcloud iam service-accounts keys create ./cloud-run-manager.json --iam-account <SA-EMAIL>
```

Store the content of the created key as a secret for this repo with the name `GCP_GITHUB_ACTIONS_SERVICE_ACCOUNT_CREDENTIALS`.

Assign the necessary roles for building and deploying with cloud run.

```
gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \
    --member=serviceAccount:${GCP_SVC_ACC} \
    --role=roles/storage.admin
gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \
    --member=serviceAccount:${GCP_SVC_ACC} \
    --role=roles/run.admin
gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \
    --member=serviceAccount:${GCP_SVC_ACC} \
    --role=roles/artifactregistry.admin
gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \
    --member=serviceAccount:${GCP_SVC_ACC} \
    --role=roles/cloudbuild.builds.editor
gcloud projects add-iam-policy-binding ${GCP_PROJECT_ID} \
    --member=serviceAccount:${GCP_SVC_ACC} \
    --role=roles/iam.serviceAccountUser
```

Now the service account used by the cloud run instance:

```
gcloud iam service-accounts create member-number-lookup --display-name "For permissio
ns required by lookup service"
gcloud iam service-accounts list  # determine the SAs email address
```

Set the email address of this account as another secret in the github repo: `GCP_MEMBER_NUMBER_LOOKUP_SERVICE_ACCOUNT_EMAIL`

## Custom domain

Setting up the custom domain is probably easiest via the console.


- navigate to [Cloud Run](https://console.cloud.google.com/run)
- go to `Manage Custom Domains`
- go to `Add mapping`
- select the `member-number-lookup` service
- select `Verify a new domain...`
- enter `makespace.org`
- follow the instructions to validate the domain
- follow the instructions to add the necessary DNS entries to route a new subdomain to this service
