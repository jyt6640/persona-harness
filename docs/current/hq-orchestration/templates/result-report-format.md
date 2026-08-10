# HQ Result Format

Use this compact terminal result for every Owner or gate decision. Send it
directly to Delivery Control when the thread tool is available. Keep it to at
most twelve lines and include only facts that change the next decision.

```text
[HQ_RESULT]
role=<role>
state=PASS|FAIL|BLOCKED|FROZEN
delta=<changed or discovered boundary>
evidence=<decisive observed evidence; separate inference>
decision=<one lawful conclusion>
next=<one role/action or an explicit user decision>
risk=<remaining uncertainty or hosted residual>
```

Do not replay history, packet hashes, raw logs, secrets, paths, or unchanged
package facts unless they are decisive. A partial result is not a GO decision,
a new candidate, or a substitute gate. If direct delivery fails, state that
fact in the final result rather than relaying through another lane.
