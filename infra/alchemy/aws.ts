/**
 * Defines the Alchemy stack that deploys Coffee Shop to AWS.
 *
 * @module
 */
import * as Alchemy from "alchemy";
import * as AWS from "alchemy/AWS";
import * as Effect from "effect/Effect";
import CoffeeApi from "../../apps/backend/src/aws/lambda.ts";
import { optionalCsv, optionalTrimmedString } from "./config.ts";
import { coffeeStackName, uiBuild } from "./shared.ts";

export default Alchemy.Stack(
  coffeeStackName,
  {
    providers: AWS.providers(),
    state: Alchemy.localState(),
  },
  Effect.gen(function* () {
    const websiteDomainName = yield* optionalTrimmedString("WEBSITE_DOMAIN");
    const websiteZoneId = yield* optionalTrimmedString("WEBSITE_ZONE_ID");
    const websiteAliases = yield* optionalCsv("WEBSITE_ALIASES");
    const websiteDomain =
      websiteDomainName && websiteZoneId
        ? {
            name: websiteDomainName,
            hostedZoneId: websiteZoneId,
            aliases: websiteAliases,
          }
        : undefined;

    const api = yield* CoffeeApi;
    const apiUrl = api.functionUrl.as<string>();

    const router = yield* AWS.Website.Router("CoffeeRouter", {
      domain: websiteDomain,
      routes: {
        "/.well-known": { url: apiUrl },
        "/api": { url: apiUrl },
        "/mcp": { url: apiUrl },
      },
      invalidation: {
        paths: "all",
      },
      tags: {
        App: "effect-coffee-shop",
        Surface: "website",
      },
    });

    const website = yield* AWS.Website.StaticSite("CoffeeWeb", {
      path: "apps/ui",
      build: {
        command: uiBuild.command,
        include: [...uiBuild.include],
        lockfile: uiBuild.lockfile,
        output: uiBuild.output,
      },
      router: {
        instance: router,
      },
      invalidation: {
        paths: "all",
      },
      tags: {
        App: "effect-coffee-shop",
        Surface: "website",
      },
    });

    return {
      apiUrl,
      assetVersion: website.files.version,
      bucketName: website.bucket.bucketName,
      distributionId: router.distribution.distributionId,
      url: router.url,
    };
  }),
);
