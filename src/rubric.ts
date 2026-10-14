// The first step: the method the agent follows before anything is named. What an agent remembers of GitHub is as old
// as its training and misses the long tail, so it doesn't pick from memory: it splits the need into parts,
// git_for_me_search finds what GitHub has for each, the agent judges those results, and git_for_me_verify checks the
// picks. Four details change the answer, so they come first: a call missing any gets questions back, not the method,
// and "unknown" is a fine answer.

export interface Details { need: string; stack?: string; platform?: string; license?: string; upkeep?: string }

const QUESTIONS = {
  stack: 'What will it be written in? This decides which repos can be used as libraries and which only beside your code, as separate tools. ("TypeScript on Node", "Python 3.12", "Rust", "no preference")',
  platform: 'Where will it run? This decides what fits at all: a browser can\'t run a Python library, and a phone can\'t host a server. ("a web app", "a CLI", "a server", "a phone app")',
  license: 'What may the result be used for? This decides which licenses are allowed: copyleft ones can bind closed-source code, and no license means no reuse. ("commercial, closed source", "open source", "personal")',
  upkeep: 'How much code are you willing to own? This decides between a maintained dependency and a fork you keep up yourself. ("needs to stay maintained", "happy to own a fork", "a one-off")',
};

export function rubric(details: Details): string {
  const missing = (Object.keys(QUESTIONS) as (keyof typeof QUESTIONS)[]).filter((key) => !details[key]?.trim());
  if (missing.length) {
    return `Git for me? Before any searching, ${missing.length === 1 ? 'one detail changes' : 'these details change'} the answer.

Need: ${details.need}

Fill in what the conversation or the codebase already says. Ask the user for the rest, all at once (with your question tool, if you have one):
${missing.map((key) => `- ${key}: ${QUESTIONS[key]}`).join('\n')}

"Not sure yet" is a fine answer: pass "unknown", and the picks will cover the range. Then call git_for_me again with all four filled in.`;
  }
  const { need, stack, platform, license, upkeep } = details;
  return `Git for me? Work out what GitHub already has for this, so nothing is built from scratch that doesn't need to be.

Need: ${need}
Stack: ${stack}
Platform: ${platform}
License: ${license}
Upkeep: ${upkeep}
Where a detail is "unknown", cover the range and say what each choice needs.

1. Split the need into its parts: 2 to 6 jobs, each with an input and an output ("a PDF -> its tables"). Name the job, not a repo.

2. Mark the parts that aren't worth a dependency WRITE: glue, configuration, logic only this project has, or a few lines a
   dependency would cost more than. A dependency for ten lines is a cost, not a feature. Every other part gets searched.

3. Search before naming anything: call git_for_me_search with, for each part that isn't WRITE,
   { "id": "table-reader", "name": "Read the tables",
     "topic": "pdf-parser",                  (the GitHub topic the job falls under: lowercase and hyphenated)
     "language": "python",                   (the stack's language, to search only repos in it; leave it out to search all)
     "keywords": ["pdf", "tables"],          (1 or 2 words a fitting repo's name or description might hold)
     "phrase": "extract tables from pdf" }   (the job in a few words, as a README would put it)
   It searches the topic's most starred and rising repos, names and descriptions holding each keyword, and README text.
   If a part comes back thin, search again with other words: a job can sit under more than one topic.

4. From what the search found, give each part its verdict:
   USE    a repo the search found does the job as it is: depend on it, or run it beside your code.
   ADAPT  one comes close: fork it or copy the part you need, license permitting, and change it.
   BUILD  none of what the search found does the job, and its results have to show it. Pick the closest repos to read first.
   Then pick candidates from the results, by what they say (description, stars, recent pushes, license, language), not by
   what you remember: 1 to 4 repos, best fit first. A repo you know that the search didn't turn up may be added, but it
   goes after the search's picks and the report marks it as from memory.

5. Before ranking, check each candidate against what bites later:
   - its license against the use: no license means all rights reserved, and copyleft can bind closed-source code;
   - its upkeep: archived, or no pushes in years, means every fix is yours;
   - the stack and platform: a library in another language can only run beside your code, as a separate tool or service;
   - forks: prefer the original, unless the fork is where the work moved.

6. Call git_for_me_verify with:
   { "need": "...",
     "components": [{ "id": "table-reader", "name": "Read the tables", "role": "a PDF -> its tables",
                      "verdict": "USE", "rationale": "why this verdict, and why these repos in this order",
                      "search": { "topic": "pdf-parser", "language": "python", "keywords": ["pdf", "tables"], "phrase": "extract tables from pdf" },
                      "candidates": [{ "id": "owner/name" }] }] }
   Pass each part's last search unchanged; a WRITE part has none. Show the user nothing until it answers: its report is
   what they see, with every fact checked on GitHub.`;
}
