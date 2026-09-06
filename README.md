# Cyber Anki

Simple, English-language flashcard practice for NKE **Introduction to Cybersecurity (ÁKIBTM013)**.

- 112 original cards: eight for each of the curriculum's 14 topics.
- Enter a six-character Neptun code, choose a topic, and practise ten cards at a time.
- Reveal an answer, then select **Again / Hard / Good / Easy**.
- Progress is stored centrally after each review and restored when the code is entered again.
- The teacher dashboard shows participation, card coverage, review counts, repeated difficulties, topic breakdowns and CSV export.

## Use

Student practice: https://cyber-anki.milemario.chatgpt.site/

Teacher dashboard: https://cyber-anki.milemario.chatgpt.site/admin

The teacher signs in with the site owner's ChatGPT account. The owner's email is configured as a private runtime value (`ADMIN_EMAIL`), not embedded in the page or repository. Students do not need a ChatGPT account when the practice site is public.

**Practice, not assessment:** ratings are self-reported. Entering a Neptun code does not verify identity, and anyone who knows a code could open that practice record. There is no public class roster. Use a university identity provider before using this as verified assessment or attendance evidence.

## GitHub Pages

A ready-built student frontend is committed in **`docs/`**. In this repository's **Settings → Pages**, select **Deploy from a branch → main → /docs**. The URL will normally be https://milemario.github.io/cyber-anki/ after GitHub finishes publishing. Private repositories require a GitHub plan that supports Pages for private repositories; this repository's visibility has not been changed.

The Pages frontend uses the hosted service above for shared progress. GitHub Pages cannot provide the database itself. The teacher link opens the hosted, sign-in-protected dashboard. The frontend also runs at the hosted URL, so it can be used before Pages is configured.

After changing the frontend or card content, run `npm run build:pages` and commit the updated `docs/` output. Redeploy the hosted service when changing server code, the deck or database schema. Keep both deployments on the same deck version.

## Scheduling

This is a small spaced-repetition implementation inspired by Anki, not Anki itself or the FSRS algorithm.

- New card: Again = 1 minute, Hard = 10 minutes, Good = 1 day, Easy = 4 days.
- Later Good/Easy ratings expand the interval, capped at 180 days.
- Again resets a card to learning; Hard does not count towards consistent recall.
- Due cards are selected before new cards, with up to ten cards per session.
- A card is labelled **remembered consistently** only after three consecutive Good/Easy ratings and an interval of at least seven days. This is not a mastery or accuracy score.

Review events use idempotency identifiers and transactional writes so network retries cannot double-count a review. Simultaneous conflicting reviews refresh instead of silently overwriting newer progress. The browser stores only a session token and Neptun code, not the authoritative review history. An internet connection is required to save reviews; an unsuccessful save remains visible and can be retried.

## Curriculum and content

The 14 topic groups follow the [official MA curriculum, course ÁKIBTM013, pages 48–49](https://antk.uni-nke.hu/document/akk-copy-uni-nke-hu/International%20Cybersecurity%20Studies%20MA%20-%20tanterv.pdf#page=48). Card wording and examples are original introductory practice material, not official examination questions.

The deck lives in `lib/cards.ts`. Keep existing card IDs stable when editing wording so students retain their review history. Substantial changes to a learning objective should receive a new ID.

Supporting references:

- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework): governance and cybersecurity risk-management context.
- [NIST SP 800-61 Rev. 3](https://csrc.nist.gov/pubs/sp/800/61/r3/final): incident-response context.
- [ISO/IEC 27001 overview](https://www.iso.org/standard/27001): ISMS requirements and continual improvement.
- [European Commission NIS2 overview](https://digital-strategy.ec.europa.eu/en/policies/nis2-directive): high-level scope, risk management and reporting. The deck does not prescribe country-specific legal duties.

## Development

Requires Node 22.13 or later; the included database tests use `node:sqlite`.

```sh
npm ci
npm run test:app
npm run build
npm run build:pages
```

- App UI: `app/study-app.tsx` and `app/globals.css`
- Teacher view: `app/admin/`
- Shared API and server-side scheduling: `lib/service.ts` and `lib/scheduler.mjs`
- Database: `db/schema.ts`, generated migrations in `drizzle/`
- Pages entrypoint: `github-pages/`, configured by `vite.pages.config.mjs`

For schema changes, run `npm run db:generate`, inspect the generated migration, and publish a new hosted version. Never change a migration after it has been applied. D1 is declared as the `DB` binding in `.openai/hosting.json`.

Teacher authentication relies on trusted identity headers set by the Sites dispatcher. Do not expose the raw Worker through another hosting provider while trusting client-supplied `oai-authenticated-*` headers. A migration to standalone Cloudflare hosting must replace this with a properly verified authentication mechanism.

Student records are held in D1, not in GitHub. CSV exports contain student identifiers and should be kept private. There are no analytics trackers, advertisements, email notifications or third-party fonts.
