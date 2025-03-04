# Hydrolix exporter

> Exports HarperDB analytics to [Hydrolix](https://hydrolix.io/)

## Status

This is still a work in progress, and does not do anything useful yet.
It is archived here so that we can pick this work back up from this starting
point next time we prioritize it.

When I mothballed this, the sysInfo events were returning an error of
"no destination table specified" from the `/ingest/event` endpoint in Hydrolix.
AFAICT it is being specified in the `x-hdx-table` header according to
Hydrolix's docs. So that needs to be diagnosed and fixed.

## Usage

1. Clone this repo into your `harperdb/components` directory
1. Install dependences: `npm i`
1. Copy `config-example.json` to `config.json`
1. Edit `config.json` to reflect your local settings
1. Build the component: `npx tsc`
1. Restart HarperDB
