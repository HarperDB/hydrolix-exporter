# Hydrolix Exporter

## Overview

This is a Harper component designed to export system logs Hydrolix. An active Hydrolix instance, with a project and table are prerequisits for running this component. When running, the component will poll Harper logs on a specified interval (see configuration options below), and publish logs to a Hydrolix table via a transform.

### What is Harper

Harper is a Composable Application Platform that merges database, cache, app logic, and messaging into a single runtime. Components like this plug directly into Harper, letting you build and scale distributed services fast, without managing separate systems. Built for geo-distributed apps with low latency and high uptime by default.

## To run locally

1. Create Hydrolix project and table
1. `git clone https://github.com/HarperDB/hydrolix-exporter.git`
1. `cd hydrolix-exporter`
1. `cp .env.example > .env` (See **Environment Variables** section for more info)
1. `npm install`
1. `npm run build`
1. `harperdb run .`

This assumes you have the Harper stack already installed. [Install Harper](https://docs.harperdb.io/docs/deployments/install-harperdb) globally.

## Exporter Configuration

Configuration can be updated at anytime via the REST interface and the system will pickup the new config automatically.

### Default Configuration Options

| Option                | Description                                                                                          | Default |
| --------------------- | ---------------------------------------------------------------------------------------------------- | ------- |
| `logLevel`            | The level of logging to be used. Options: 'all', 'notify', 'error', 'warn', 'info', 'debug', 'trace' | `all`   |
| `pollInterval`        | The interval in seconds to poll for new logs.                                                        | `60`    |
| `logIngestPercentage` | Percentage of logs to be ingested. Expressed as a decimal. Options: 0-1                              | `1`     |

> [!NOTE]  
> `logIngestPercentage` specifies the percentage of fetched logs to be ingested into Hydrolix. A value less than 1 evenly samples the specified percentage of logs. For example, `0.75` means 75% of the logs will be ingested, while 25% will be skipped. A value of 0 will skip log ingestion altogether.

### Configuration REST Interface

| Endpoint                        | Description                                             |
| ------------------------------- | ------------------------------------------------------- |
| GET `/hydrolix-exporter/config` | REST endpoint to view export configuration properties   |
| PUT `/hydrolix-exporter/config` | REST endpoint to update export configuration properties |

#### Get current configuration:

```
GET /hydrolix-exporter/config

Response: 200
{
    "logLevel": "all",
    "pollInterval": 60,
    "logIngestPercentage": 1,
    "updatedAt": 1697030400000,
}
```

#### Set configuration:

```
POST /hydrolix-exporter/config

BODY:
{
    "logLevel": "all",
    "pollInterval": 60,
    "logIngestPercentage": 1
}

Response: 204
```

## Environment Variables

To run the component, you will need to set up a `.env` file in the root of the component directory.

Copy the `.env.example` file to `.env`. Fill in appropriate values.

| Variable              | Description                                   |
| --------------------- | --------------------------------------------- |
| HYDROLIX_USERNAME     | Email address for Hydrolix user               |
| HYDROLIX_PASSWORD     | Password for Hydrolix user                    |
| HYDROLIX_INSTANCE_URL | Url for Hydrolix instance (no trailing slash) |
| HYDROLIX_PROJECT_NAME | Name of Hydrolix project                      |
| HYDROLIX_TABLE_NAME   | Name of table to export logs                  |

## Hydrolix Tables & Transforms

To export logs to Hydrolix, you will need to create a table. This can be done via the Hydrolix UI for your instance, or [via REST API](https://docs.hydrolix.io/reference/config_v1_orgs_projects_tables_create).
The transform will automatically created for the table if it does not alreay exist. See `/transformTemplates` for detail on the transform.
