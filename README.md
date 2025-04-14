# Hydrolix Logs Exporter

## Overview

This is a Harper component designed to export system logs and analytics to data lakes. It has been initially designed to support Hydrolix, but could easily be extended to support other platforms.

## Getting Started

1. `git clone https://github.com/HarperDB/hydrolix-exporter.git`

1. `cd hydrolix-exporter`
1. `npm run build`
1. `harperdb run .`

This assumes you have the Harper stack already installed. [Install Harper](https://docs.harperdb.io/docs/deployments/install-harperdb) globally.

## Export Configuration

Configuration can be updated at anytime via the REST interface and the system will pickup the new config automatically.

### Default Configuration Options

| Option                | Description                                                                                          | Default |
| --------------------- | ---------------------------------------------------------------------------------------------------- | ------- |
| `logLevel`            | The level of logging to be used. Options: 'all', 'notify', 'error', 'warn', 'info', 'debug', 'trace' | `all`   |
| `includeSystemInfo`   | Whether to export system analytics information. Options: true, false                                 | `true`  |
| `pollInterval`        | The interval in seconds to poll for new logs.                                                        | `60`    |
| `logIngestPercentage` | Percentage of logs to be ingested. Expressed as a decimal. Options: 0-1                              | `1`     |

### Configuration REST Interface

| Endpoint            | Description                                             |
| ------------------- | ------------------------------------------------------- |
| GET `/exportConfig/:export_destination` | REST endpoint to view export configuration properties   |
| PUT `/exportConfig/:export_destination` | REST endpoint to update export configuration properties |

#### Get current configuration:

```
GET /exportConfig/hydrolix

Response: 200
{
    "logLevel": "all",
    "includeSystemInfo": true,
    "pollInterval": 60,
    "logIngestPercentage": 1,
    "updatedAt": 1697030400000,
}
```

#### Set configuration:

```
PUT /exportConfig/hydrolix

BODY:
{
    "logLevel": "all",
    "includeSystemInfo": true,
    "pollInterval": 60,
    "logIngestPercentage": 1
}

Response: 204
```

## Environment Variables/Data Lake Configuration

To run the component, you will need to set up a `.env` file in the root of the component directory, and a `config.json` file in `/src`. 

Copy the `.env.example` file to `.env`, and `/src/config-example.json` to `/src/config.json`. Fill in appropriate values.

## Hydrolix Tables & Transforms

To export logs to Hydrolix, you will need to [create a table](https://docs.hydrolix.io/reference/config_v1_orgs_projects_tables_create) and [corresponding transform](https://docs.hydrolix.io/reference/config_v1_orgs_projects_tables_transforms_create) in Hydrolix.
One table/transform pair is required for logs, and one for system analytics (if enabled). See `/transformTemplates` for example JSON to create the transforms.