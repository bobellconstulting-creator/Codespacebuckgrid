# Tony stress-test harness (added 2026-07-02)

Regression suite born from the July 2 stress test — run it against any change
to the placement engine or chat route.

    npm run dev -- -p 4801        # (optionally OLLAMA_BASE_URL=http://localhost:11434
                                  #  OLLAMA_MODEL=... to E2E-test without Gemini quota)
    cd evals/stress
    node run.mjs                  # 24-turn battery, 6 real parcels → results/
    node audit.mjs                # geometry audit: containment, edge distances,
                                  # access-vs-bedding/plots, claim-vs-map truth
    python3 render.py             # placements over ESRI satellite → renders/

Endpoint override: TONY_URL=https://codespacebuckgrid.vercel.app/api/chat node run.mjs
Pacing: PACE_MS=70000 for free-tier Gemini RPM.
