# Championship Requirements Map

Source material:

- `C:\Users\Damir\Downloads\Памятка участнику Чемпионата.docx`
- `C:\Users\Damir\Downloads\Презентация МАКЕТ КАИ 1.ppt`

## Extracted Requirements

| Requirement from the participant memo | Biz Arena implementation |
|---|---|
| Company name should contain the university and login, for example `AFKAIstudent1`. | The one-click demo now creates the player company as `AFKAIstudent1`. |
| Players learn the interface, concepts, and tasks in the first period. | The demo starts on the operations/production tab and includes the first-turn tutorial as a backup path. |
| Teams make decisions by periods. | The demo uses manual turns: each click of `Next turn` acts as one recalculation period. |
| Recalculation changes the economic situation. | The server recalculates demand, sales, money, debt, factory stats, contracts, and leaderboard after each turn. |
| Players buy products and work with contracts for tires and motorcycles. | The defense scenario is the motorcycle factory: components, assembled motorcycles, contracts, sale orders, and rating. |
| Contract conditions matter: price and quality mismatch can block fulfillment. | The game exposes contract progress, target sales, reward, deadline, and assigned player data. |
| Ranking determines winners; top three teams are awarded. | The results screen shows the winner and top-3 leaderboard; JSON export preserves the ranking. |
| The event has fixed recalculation moments. | The defense demo compresses the same idea into a 10-turn season for a 3 to 5 minute live presentation. |

## Defense Interpretation

Biz Arena is not a full clone of the original championship system. It is a focused educational simulator that reproduces the key learning loop:

1. Register a company with an identifiable KAI-style name.
2. Make production, staffing, purchasing, pricing, and contract decisions.
3. Resolve a period.
4. Compare companies by rating.
5. Explain the final result through business value, liquidity, debt, contracts, and production balance.

## Demo Defaults

- Room: `KAI Demo Championship`
- Company: `AFKAIstudent1`
- Scenario: `motorcycles`
- Difficulty: `easy`
- Season: 10 turns
- Opponents: 2 bots
- Start mode: automatic start after room setup
- Start tab: operations/production

## What To Say If Asked About Differences

The original championship lasts 72 hours and recalculates once per hour. For a defense, Biz Arena uses the same period/recalculation principle but compresses it into a short demo season so the committee can see the full cycle during one presentation.
