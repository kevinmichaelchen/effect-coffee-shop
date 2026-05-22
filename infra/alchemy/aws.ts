/**
 * Defines the Alchemy stack that deploys Coffee Shop to AWS.
 *
 * @module
 */
import * as Alchemy from "alchemy";
import * as AWS from "alchemy/AWS";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import CoffeeApi from "../../apps/backend/src/platforms/aws/lambda.ts";
import { coffeeStackName, uiBuild } from "./shared.ts";

const optionalString = (name: string) =>
  Config.string(name).pipe(Config.option, Config.map(Option.getOrUndefined), Effect.orDie);

const optionalCsv = (name: string) =>
  optionalString(name).pipe(
    Effect.map((value) =>
      value
        ?.split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  );

export default Alchemy.Stack(
  coffeeStackName,
  {
    providers: AWS.providers(),
    state: Alchemy.localState(),
  },
  Effect.gen(function* () {
    const websiteDomainName = yield* optionalString("WEBSITE_DOMAIN");
    const websiteZoneId = yield* optionalString("WEBSITE_ZONE_ID");
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
