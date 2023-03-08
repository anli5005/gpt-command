#! /bin/zsh

GPT_DENO_PATH="${0:a:h}/gpt.ts"
eval "$(deno run --allow-net=api.openai.com --allow-run=pbcopy $GPT_DENO_PATH $@)"
