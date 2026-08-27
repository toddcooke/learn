# PostgreSQL — flashcards

133 cards. Exported to Anki by scripts/export-anki.mjs.
<!-- domains: Architecture | Schema Design | Querying | Indexing | Transactions | Administration | Replication -->

## Architecture

### `toast` · TOAST

**What problem does TOAST solve, and how?**

<details><summary>Answer</summary>

PostgreSQL's fixed 8kB page size can't hold a very large field value directly, so any row wider than about 2kB gets its big attributes compressed and, if still too large, chopped into chunks stored in a separate TOAST table linked back to the row. This keeps the main table compact so more of it fits in the buffer cache, and the out-of-line data is only fetched when a query actually needs that column.

</details>

### `jsonb` · JSONB

**How does jsonb differ from json?**

<details><summary>Answer</summary>

jsonb parses the input once and stores it in a decomposed binary layout, so later processing skips reparsing and runs noticeably faster, and it can be indexed (e.g. with GIN). The tradeoff is a bit more overhead on insert, and it discards whitespace, key order, and duplicate object keys, keeping only the last value for a repeated key.

</details>

### `json` · JSON

**What does the json type preserve that jsonb does not?**

<details><summary>Answer</summary>

json stores the input text byte-for-byte, so whitespace, the original ordering of object keys, and any duplicate keys are all kept exactly as entered. Every processing function has to reparse that text on each call, which is slower than jsonb, and json values can't be indexed with a GIN operator class the way jsonb can.

</details>

### `uuid` · UUID

**What is a UUID, and which generation algorithms does PostgreSQL support natively?**

<details><summary>Answer</summary>

A 128-bit identifier generated so that the odds of any two systems independently producing the same value are vanishingly small, which makes UUIDs a better fit than sequence-based keys for identifiers assigned across multiple distributed nodes. PostgreSQL natively generates UUIDv4 (fully random) and UUIDv7 (embeds a timestamp, so values sort roughly by creation order) values.

</details>

### `array-type` · Array

**Where do PostgreSQL array subscripts start by default, and can the lower bound be changed?**

<details><summary>Answer</summary>

Array subscripts start at 1, not 0 — an n-element array runs from array[1] through array[n]. A column can hold arrays of almost any base or composite type, and an explicit lower bound other than 1 can be set at assignment time if needed.

</details>

### `range-type` · Range Type

**What do the bracket and parenthesis characters mean in a range literal like [4,8) or (3,9)?**

<details><summary>Answer</summary>

Square brackets mark an inclusive bound (the endpoint itself is part of the range) and parentheses mark an exclusive bound (the endpoint is excluded). A range constructor's two-argument form defaults to inclusive-lower/exclusive-upper, and a missing bound on either side is treated as unbounded in that direction.

</details>

### `null-three-valued-logic` · NULL

**Why does WHERE x <> NULL never return any rows?**

<details><summary>Answer</summary>

PostgreSQL's boolean logic is three-valued — true, false, or unknown — and any comparison against NULL evaluates to unknown rather than true or false, so a WHERE clause built from it filters the row out just like a false result would. Testing for NULL requires IS NULL / IS NOT NULL (or IS DISTINCT FROM) instead of an equality or inequality operator.

</details>

### `numeric-type` · NUMERIC

**What makes numeric different from float8 for storing money or exact quantities?**

<details><summary>Answer</summary>

numeric stores exact, arbitrary-precision decimal values — it can hold up to 131072 digits to the left of the decimal separator and as many as 16383 digits to the right of it — with no binary-rounding error, whereas floating-point types trade exactness for speed and can't represent every decimal fraction precisely. The cost is that numeric arithmetic is slower than native floating-point math.

</details>

### `timestamptz` · TIMESTAMPTZ

**How does PostgreSQL actually store a timestamptz value?**

<details><summary>Answer</summary>

On input, any stated or assumed time zone is used to convert the value to UTC, and only that UTC instant is stored internally — the original zone is not retained. When the value is read back out, the server converts it to whatever zone the session's TimeZone setting specifies before displaying it, so the same stored instant can appear differently to different sessions.

</details>

### `shared-buffers` · shared_buffers

**What does the shared_buffers setting control?**

<details><summary>Answer</summary>

It sizes PostgreSQL's own shared-memory cache of table and index pages, separate from the operating system's page cache.

</details>

### `shared-buffers-sizing` · shared_buffers

**What starting value is commonly recommended for shared_buffers, and why not just set it much higher?**

<details><summary>Answer</summary>

On a dedicated server with 1GB or more of RAM, a reasonable starting value is about 25% of system memory. Because PostgreSQL also relies on the operating system cache — the OS ends up caching much of the same data — allocating more than roughly 40% of RAM to shared_buffers is unlikely to work better than a smaller amount, and larger settings usually require a corresponding increase in max_wal_size to spread out writing large quantities of new or changed data.

</details>

### `wal` · Write-Ahead Log (WAL)

**Why does WAL let PostgreSQL skip flushing every changed data page on commit?**

<details><summary>Answer</summary>

The rule is that a change to a data file must never hit disk before the WAL record describing it has been flushed, so after a crash any not-yet-applied change can be replayed (redone) from the log. That means only the WAL — written sequentially and therefore cheap to sync — needs to be flushed at commit time, not the scattered data pages a transaction may have touched.

</details>

### `process-model` · Process Model

**How does the PostgreSQL server handle a new client connection, and what stays behind to accept the next one?**

<details><summary>Answer</summary>

The always-running supervisor postgres process waits for connections and forks a new server process for each one; from then on the client and its dedicated backend communicate directly, with no intervention from the supervisor, which returns to listening. Backend processes come and go per session while the supervisor persists — every session is a full OS process rather than a thread, which is why high connection counts are expensive and why max_connections and external connection poolers matter so much in PostgreSQL.

</details>

### `checkpoint` · Checkpoint

**What does a checkpoint accomplish, and what triggers one?**

<details><summary>Answer</summary>

At a checkpoint all dirty data pages are flushed to disk and a checkpoint record is written to WAL, which bounds crash recovery — replay starts from the latest checkpoint's redo record — and allows older WAL segments to be recycled or removed. One begins every checkpoint_timeout (default 5 minutes) or when WAL is about to exceed max_wal_size (default 1 GB), whichever comes first.

</details>

### `checkpoint-tuning` · Checkpoint Tuning

**Why can spacing checkpoints further apart actually shrink the total volume of WAL written?**

<details><summary>Answer</summary>

With full_page_writes on (the default), the first change to each data page after a checkpoint logs the entire page image so a torn write can be repaired, so more frequent checkpoints mean more full-page images in the WAL and more disk I/O overall. checkpoint_completion_target (default 0.9) additionally spreads each checkpoint's writes across most of the interval rather than issuing them in one burst.

</details>

### `work-mem` · work_mem

**What does work_mem limit, and why can a single query use far more memory than its value?**

<details><summary>Answer</summary>

It caps the memory one sort or hash operation — ORDER BY, DISTINCT, merge and hash joins, hash aggregation — may use before spilling to temporary disk files, and defaults to only 4MB. The limit is per operation, not per query or session: a complex query can run several sorts and hashes simultaneously and every concurrent session gets the same allowance, so total usage can be many times work_mem, and hash-based operations may additionally use work_mem times hash_mem_multiplier (default 2.0).

</details>

### `character-types` · Character Types

**Does declaring a column char(n) instead of varchar(n) or text buy any performance in PostgreSQL, and how do trailing-space semantics differ across the three?**

<details><summary>Answer</summary>

No — unlike in some other databases there is no performance advantage, and char(n) is usually the slowest of the three because blank-padding inflates its storage, which is why the docs recommend text or varchar for most uses. Trailing spaces are also treated as semantically insignificant when comparing two character(n) values but remain significant in varchar and text comparisons (and in LIKE/regex matching), a mismatch that can produce surprises when the types are mixed.

</details>

### `exclusion-constraint` · Range Constraints

**Why is UNIQUE the wrong tool for preventing double-booked time ranges, and what enforces that rule instead?**

<details><summary>Answer</summary>

UNIQUE only rejects rows holding an identical value, while the property worth enforcing on a range column is usually 'no two rows overlap' — the docs call UNIQUE usually unsuitable for range types and point to an exclusion constraint instead: EXCLUDE USING GIST (during WITH &&) rejects any inserted or updated row whose range overlaps one already stored. With the btree_gist extension the constraint can pair scalar equality with range overlap — EXCLUDE USING GIST (room WITH =, during WITH &&) — so overlapping reservations are rejected only when they are for the same room.

</details>

### `query-pipeline` · Query Processing

**What four stages does a SQL statement pass through inside a backend, and at which one do views get expanded?**

<details><summary>Answer</summary>

The parser checks syntax and builds a query tree; the rewrite system then applies rules stored in the system catalogs — this is where a query against a view is rewritten into one against the view's base tables; the planner/optimizer generates the possible paths to the same result, estimates each one's cost, and picks the cheapest; and the executor recursively steps through the chosen plan tree, scanning relations, sorting and joining, and handing back the result rows.

</details>

### `storage-file-layout` · On-Disk Layout

**Why can't you locate a table's data file purely from its OID, and what happens once that file reaches 1GB?**

<details><summary>Answer</summary>

Each table and index is stored in files named after its filenode number (pg_class.relfilenode), which often starts out equal to the OID but diverges after operations that rewrite the file — TRUNCATE, REINDEX, CLUSTER, and some ALTER TABLE forms assign a fresh filenode while the OID never changes. Once a relation exceeds 1GB it is split into gigabyte-sized segments (filenode, filenode.1, filenode.2, ...), a scheme that sidesteps filesystem file-size limits.

</details>

## Schema Design

### `redundancy-anomalies` · Redundancy

**Storing a customer address on every order line is redundant. What three concrete failure modes does that redundancy cause?**

<details><summary>Answer</summary>

An update anomaly, where changing the address reaches some copies and not others and leaves the table contradicting itself; an insertion anomaly, where a customer who has not yet ordered cannot be recorded at all because there is no row to hold them; and a deletion anomaly, where removing a customer's last order also erases the customer. These three failures, rather than any aesthetic preference, are what normalization exists to prevent.

</details>

### `functional-dependency` · Functional Dependency

**A functional dependency is written A -> B. What exactly does that assert about the data, and why is it something decided from the modeled domain rather than discovered by scanning the current rows?**

<details><summary>Answer</summary>

A -> B asserts that every value of A is associated with exactly one value of B, so no two rows may ever agree on A while disagreeing on B — it is a rule about what the data is allowed to look like, not a pattern read off from what rows happen to exist today. A table with one customer per city right now does not make city -> customer_name a real dependency unless that business rule is guaranteed to keep holding for every future row too. A dependency whose left side is a whole candidate key is unremarkable — that's what a key means — but a dependency on anything less means the table is recording a fact about something other than its own subject.

</details>

### `natural-vs-surrogate-key` · Key Selection

**What's the tradeoff between a natural key and a surrogate key, and why doesn't choosing a surrogate let you drop the uniqueness constraint on the natural key?**

<details><summary>Answer</summary>

A natural key like an email address or SKU is meaningful on sight but can change, or can turn out not to be unique once some edge case appears — a bad thing to discover in a primary key. A surrogate key such as a generated integer or UUID is stable and cheap to reference precisely because it carries no meaning of its own, but it only replaces the natural key's role as the row's identifier; it does nothing to stop the natural key itself from being duplicated, so a UNIQUE constraint on the natural key is still needed to keep the business rule it represents actually true.

</details>

### `unique-vs-primary-key` · Uniqueness Constraints

**A table has a UNIQUE constraint on one column and a PRIMARY KEY on another. What actually differs between what each one allows to be stored?**

<details><summary>Answer</summary>

UNIQUE permits any number of rows to hold a null in the constrained column, because by default two nulls are never considered equal to each other and so can never be shown to collide; PRIMARY KEY carries that same uniqueness rule but adds NOT NULL on top of it, so a primary key column can never hold a null at all. A table can declare as many UNIQUE constraints as it needs, one per alternate identifier, but only one of them can be designated the primary key.

</details>

### `check-constraint` · CHECK Constraint

**A CHECK constraint's expression evaluates to null for a given row, rather than true or false. Does that row pass or get rejected, and why does this matter for a nullable column?**

<details><summary>Answer</summary>

A CHECK constraint is satisfied whenever its expression evaluates to true or to null, and only rejects the row when the expression evaluates to false outright, so a null result passes exactly like a true one would. Because an expression with a null operand usually evaluates to null itself, a CHECK built on a nullable column will not, on its own, stop that column from being null — the constraint simply never gets the chance to return false.

</details>

### `foreign-key-basics` · Foreign Key

**What must be true of the columns a FOREIGN KEY references on the other table, and what happens when the referencing column itself holds null?**

<details><summary>Answer</summary>

A foreign key must reference columns that are a primary key, a unique constraint, or a non-partial unique index on the target table — pointing at an arbitrary, unconstrained column is rejected outright, since nothing would guarantee a single match. A referencing row is exempt from the check by default whenever any of its referencing columns is null, so a foreign key alone still permits unlinked rows; declaring the referencing column NOT NULL is what closes that escape hatch.

</details>

### `referential-actions` · ON DELETE / ON UPDATE

**ON DELETE and ON UPDATE each accept one of five actions. What does each of CASCADE, SET NULL, SET DEFAULT, RESTRICT, and NO ACTION actually do to the rows still referencing the changed row?**

<details><summary>Answer</summary>

CASCADE propagates the change by deleting or updating the referencing rows along with it; SET NULL clears the referencing column to null, and SET DEFAULT resets it to the column's default, though either one still fails outright if the resulting value would itself violate the constraint. RESTRICT and NO ACTION both reject an operation that would strand a referencing row, and NO ACTION is simply what applies whenever no action is written at all, which makes it the default.

</details>

### `deferrable-constraints` · Constraint Timing

**What does marking a constraint DEFERRABLE INITIALLY DEFERRED actually enable that an ordinary NOT DEFERRABLE constraint cannot, and how can SET CONSTRAINTS override that at runtime?**

<details><summary>Answer</summary>

By default every constraint is NOT DEFERRABLE and gets checked immediately after the statement that could violate it, but UNIQUE, PRIMARY KEY, EXCLUDE, and foreign-key constraints can instead be marked DEFERRABLE, and INITIALLY DEFERRED postpones the check all the way to transaction commit — which is what makes otherwise-impossible sequences tractable, like inserting two rows that reference each other or swapping the unique values held by two existing rows without either momentarily colliding with the other. SET CONSTRAINTS can flip a deferred constraint back to IMMEDIATE within the current transaction, forcing an early check, and a deferrable constraint can never serve as the conflict target of an ON CONFLICT clause.

</details>

### `match-full` · Composite FK Matching

**A composite foreign key has several referencing columns. How does adding MATCH FULL change which rows are exempt from the constraint, compared to leaving it unqualified?**

<details><summary>Answer</summary>

Left unqualified, a foreign key uses MATCH SIMPLE by default, under which a row escapes the constraint the moment any single referencing column is null, even when the rest are populated and would otherwise need a match. MATCH FULL replaces that with an all-or-nothing rule: a row is exempt only when every referencing column is null, so a row mixing null and non-null values across its foreign-key columns is guaranteed to fail rather than slip through unenforced.

</details>

### `not-valid-constraint` · Constraint Rollout

**Adding a CHECK or FOREIGN KEY constraint to a table that already holds data normally means a full-table scan under a heavy lock. What does NOT VALID change, and what does a later VALIDATE CONSTRAINT still have to check?**

<details><summary>Answer</summary>

NOT VALID skips that scan entirely — the constraint is added and immediately enforced against every future insert or update, but PostgreSQL makes no claim yet that existing rows satisfy it, and the ADD CONSTRAINT itself can commit right away instead of waiting on a scan. Running VALIDATE CONSTRAINT afterward performs the deferred scan, but only against pre-existing rows, since concurrent sessions are already enforcing the constraint on anything they touch — which is why validation only needs a SHARE UPDATE EXCLUSIVE lock rather than the heavier lock a scanning ADD CONSTRAINT requires.

</details>

### `first-normal-form` · 1NF

**What rule does 1NF impose on every cell in a table, and what does a violation of that rule look like in a real column?**

<details><summary>Answer</summary>

First normal form requires that every cell hold a single value, with no repeating groups or lists embedded inside one field. A products column holding something like 'Widget x2, Gadget x1' violates it outright (PostgreSQL's array and jsonb types depart from strict 1NF on purpose; the rule bites when the elements must be queried or constrained individually) — the fix is to give each order-product pairing its own row, so a query can filter or aggregate on product without first having to parse a string, and every cell holds exactly one value.

</details>

### `second-third-normal-form` · 2NF and 3NF

**A table's non-key attributes can fail 2NF or 3NF in different ways. What's the difference between the partial dependency 2NF forbids and the transitive dependency 3NF forbids?**

<details><summary>Answer</summary>

2NF applies to a table with a composite primary key and forbids a partial dependency: an attribute that depends on only part of that key rather than the whole thing, such as a price that depends only on product_id inside a table keyed on (order_id, product_id). 3NF instead forbids a transitive dependency between two non-key attributes — one non-key attribute determining another, as when a customer name depends on a customer email that in turn depends on the actual key — so the attribute is only reachable through another attribute rather than directly from the key.

</details>

### `bcnf` · BCNF

**BCNF tightens 3NF's rule about determinants. What extra requirement does it add, and what specific situation does that close that 3NF still allowed?**

<details><summary>Answer</summary>

3NF excuses a non-key determinant whenever the attribute it determines is itself part of some candidate key — a dependency landing on a prime attribute passes even though its determinant isn't a full candidate key. BCNF removes that excuse entirely: every determinant of a dependency must be a candidate key outright, which catches the case of two overlapping candidate keys where a determinant that is only part of a candidate key, never a whole one, determines an attribute belonging to another candidate key, forcing that dependency out into its own table.

</details>

### `junction-table` · Many-to-Many

**Why can't a single foreign key express a many-to-many relationship between two tables, and what does the table that resolves it normally use as its primary key?**

<details><summary>Answer</summary>

A foreign key records only one reference per row, which is enough for a one-to-many relationship but not for many-to-many, where a row on either side legitimately needs to relate to many rows on the other side no matter which table would hold the key. A junction table resolves this by holding one row per pairing, with a foreign key to each side, and its primary key is normally the composite of those two foreign keys together, since that pair is exactly what keeps a given pairing from being recorded twice.

</details>

### `generated-columns` · Generated Column

**Why can't an INSERT or UPDATE supply its own value for a stored generated column, and what keyword is accepted in its place?**

<details><summary>Answer</summary>

A generated column is always computed from other columns in the same row, so a value can't be specified for it directly in INSERT or UPDATE — only the keyword DEFAULT is accepted where a value would normally go. That's true of both kinds PostgreSQL supports: the stored form recomputes and persists that result on every write, occupying storage just like an ordinary column, while VIRTUAL — the default when neither keyword is written — recomputes the expression on every read instead and stores nothing. The generation expression is restricted to immutable functions, can't reference a subquery or another generated column, and can't touch anything outside the current row, which is what keeps its value fully determined by the row itself rather than by outside state.

</details>

### `no-action-vs-restrict` · Referential Actions

**ON DELETE NO ACTION and ON DELETE RESTRICT both refuse to orphan a row. What actually differs between them?**

<details><summary>Answer</summary>

More than timing. RESTRICT is stricter in substance: it rejects the moment a matching referencing row is found, even when the state after the operation would still satisfy the constraint — which is why ON UPDATE RESTRICT blocks updating a referenced value to one that's merely distinct but compares as equal — and it can never be deferred. NO ACTION, the default, checks against the post-operation state instead, so a change that leaves no dangling reference succeeds where RESTRICT would refuse it; only when the constraint is actually deferred (DEFERRABLE INITIALLY DEFERRED, or switched with SET CONSTRAINTS) does that check wait until commit, tolerating an inconsistent intermediate state as long as things line up by then.

</details>

### `identity-vs-serial` · Identity Column

**How does a GENERATED ... AS IDENTITY column differ from the serial pseudo-type, and what separates ALWAYS from BY DEFAULT?**

<details><summary>Answer</summary>

serial is not a real type but shorthand that creates a sequence, sets the column's default to nextval on it, marks the column NOT NULL, and ties the sequence's lifetime to the column with OWNED BY; an identity column is the SQL-standard way to get the same auto-numbering from an implicit sequence, and it too is automatically NOT NULL. GENERATED ALWAYS rejects an explicitly supplied value unless the INSERT says OVERRIDING SYSTEM VALUE, guarding against accidental overwrites, while BY DEFAULT lets an explicit value win — and neither approach guarantees uniqueness by itself (the sequence can be reset or values inserted manually), which still takes a PRIMARY KEY or UNIQUE constraint.

</details>

## Querying

### `cte` · CTE (WITH query)

**What does a WITH clause (CTE) let you do that a subquery in FROM does not as cleanly?**

<details><summary>Answer</summary>

It names an auxiliary query so it can be referenced later in the same statement, including multiple times, which makes multi-step queries easier to read and lets a computed result be reused without repeating the SQL. By default a non-recursive, side-effect-free CTE referenced only once is folded into the parent query's plan rather than evaluated separately, while one referenced multiple times is computed once and reused.

</details>

### `recursive-cte` · Recursive CTE

**How does WITH RECURSIVE evaluate a query?**

<details><summary>Answer</summary>

It runs the non-recursive term first to seed a working table, then repeatedly re-runs the recursive term against only the current contents of that working table, feeding each round of new rows into the result until a round produces nothing more. This iterative process, not true recursion, is what makes it useful for walking hierarchical data like org charts or bill-of-materials trees.

</details>

### `window-function` · Window Function

**What distinguishes a window function call from a plain aggregate?**

<details><summary>Answer</summary>

Adding an OVER clause to a function tells PostgreSQL to compute it across a defined window of related rows — optionally split into PARTITION BY groups and ordered within each — while still returning one output row per input row, instead of collapsing the group into a single row the way GROUP BY does. An ordinary aggregate can even be reused as a window function this way.

</details>

### `join-types` · JOIN

**What is the key behavioral difference between INNER JOIN and the outer join variants (LEFT/RIGHT/FULL)?**

<details><summary>Answer</summary>

INNER JOIN keeps only rows that find a match on both sides of the join condition. LEFT JOIN keeps every row from the left table regardless of a match, filling the right side's columns with NULL when there isn't one; RIGHT JOIN does the mirror image for the right table; FULL JOIN keeps unmatched rows from both sides at once.

</details>

### `subquery` · EXISTS

**How does EXISTS(subquery) decide whether it is true?**

<details><summary>Answer</summary>

It only checks whether the subquery returns at least one row — the actual column values in that row are irrelevant, so the subquery is commonly written as EXISTS(SELECT 1 WHERE ...). PostgreSQL can stop evaluating the subquery as soon as one row is found, and a correlated subquery may reference columns from the enclosing query as though they were constants.

</details>

### `on-conflict` · ON CONFLICT (Upsert)

**What does INSERT ... ON CONFLICT DO UPDATE actually do?**

<details><summary>Answer</summary>

It attempts a normal INSERT, and if the row conflicts with the unique constraint or unique index named (or inferred from the listed columns) as the mandatory conflict target, it instead runs the given UPDATE against the existing conflicting row rather than raising an error — the classic 'upsert' pattern. ON CONFLICT DO NOTHING is the simpler variant that silently skips the row; its conflict target is optional (omitted, it handles conflicts with any usable constraint or unique index), and it alone can also arbitrate on an exclusion constraint — DO UPDATE cannot, and neither form accepts a deferrable constraint or index as its arbiter.

</details>

### `full-text-search` · Full-Text Search

**What are tsvector and tsquery for, and how are they compared?**

<details><summary>Answer</summary>

to_tsvector reduces a document's text to a sorted list of normalized lexemes (case-folded, suffix-stripped, stop words removed) for efficient searching, and to_tsquery normalizes search terms the same way, optionally combined with AND/OR/NOT/FOLLOWED-BY operators. The @@ match operator returns true when a tsvector satisfies a tsquery, and this comparison can be sped up with a GIN or GiST index.

</details>

### `aggregate-function` · Aggregate Function

**What happens to an aggregate call like COUNT(*) or AVG(x) when there is no GROUP BY?**

<details><summary>Answer</summary>

Without GROUP BY, PostgreSQL treats the entire result set of the query as one group, so the aggregate collapses all matching rows down into a single output row. Add a GROUP BY clause and the same aggregate is instead computed once per distinct group of values.

</details>

### `group-by-having` · GROUP BY / HAVING

**How does HAVING differ from WHERE in a grouped query?**

<details><summary>Answer</summary>

WHERE filters individual rows before they're grouped, so it can't reference an aggregate computed over the group; HAVING runs after GROUP BY has formed the groups and is evaluated once per group, which is why it's the clause used for conditions like HAVING COUNT(*) > 5 or HAVING SUM(amount) > 1000.

</details>

### `window-default-frame` · Window Frame

**Why does sum(amount) OVER (ORDER BY day) give a running total rather than each partition's grand total?**

<details><summary>Answer</summary>

With ORDER BY present but no explicit frame clause, the default frame is RANGE UNBOUNDED PRECEDING — all rows from the partition start up through the current row's last ORDER BY peer — so an aggregate accumulates row by row along the ordering. Without ORDER BY every row is a peer and the whole partition is the frame, so to get a partition-wide total either drop the ORDER BY or state the frame explicitly as ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING.

</details>

### `ranking-functions` · Ranking Functions

**How do row_number(), rank(), and dense_rank() number tied rows differently?**

<details><summary>Answer</summary>

row_number() assigns unique consecutive numbers within the partition regardless of ties; rank() gives every peer in a tie the same number — the row_number of the group's first row — and then jumps ahead by the size of the tie, leaving gaps (1, 2, 2, 2, 5); dense_rank() continues with the next consecutive integer, effectively counting peer groups with no gaps (1, 2, 2, 2, 3). The companions lag() and lead() return a value from the row a given offset before or after the current row in the partition — offset defaults to 1, and a supplied default (otherwise NULL) is returned when no such row exists.

</details>

### `jsonb-operators` · JSON Operators

**In a chain like data->'address'->>'city', why does only the last step use ->>, and what does the @> containment operator actually test?**

<details><summary>Answer</summary>

-> returns the extracted field still typed json/jsonb so further operators can keep drilling in, while ->> returns it converted to plain text — the natural final step for display or comparison (both accept a text key for object fields or an integer for array elements, and JSON arrays are indexed from zero, with negative integers counting from the end, unlike one-based SQL arrays). The @> operator tests whether the right-hand structure matches the left-hand document at the corresponding nesting level (extra keys and array elements on the left are ignored); it does not search recursively, so a pair nested inside another key fails a top-level containment test.

</details>

### `not-in-null-trap` · NOT IN vs NOT EXISTS

**Why can x NOT IN (subquery) return no rows even for values of x that clearly aren't in the subquery's result?**

<details><summary>Answer</summary>

NOT IN is equivalent to <> ALL: when x equals no returned value but the subquery yields even one NULL, the overall result is null rather than true — per SQL's rules for boolean combinations of nulls — and a WHERE clause discards null results exactly like false ones. A correlated NOT EXISTS only tests whether a matching row exists and never compares against a possibly-null value, which makes it the safe formulation whenever the subquery's column can contain nulls.

</details>

### `outer-join-on-vs-where` · Outer Join Conditions

**Moving a right-table condition from a LEFT JOIN's ON clause into WHERE changes the result — why?**

<details><summary>Answer</summary>

A restriction in ON is processed before the join, so left rows with no qualifying right-side match still come through null-extended; the same restriction in WHERE is processed after the join, where comparing those null-extended columns evaluates to unknown rather than true, so the padded rows are filtered back out and the query behaves like an inner join. Placement makes no difference for an inner join — only outer joins expose it — so when the intent is to keep unmatched left rows, the right-table filter belongs in ON.

</details>

### `cte-search-cycle` · SEARCH / CYCLE

**What do the SEARCH and CYCLE clauses add to a recursive CTE, and do they change how its rows are actually computed?**

<details><summary>Answer</summary>

Neither changes the iterative working-table evaluation — each is internally expanded into essentially the accumulator bookkeeping a developer would hand-write: a growing array of visited rows for SEARCH DEPTH FIRST and for CYCLE's path column, or a depth counter for SEARCH BREADTH FIRST. SEARCH adds an ordering column that the outer query must still ORDER BY (evaluation happens to emit rows breadth-first, but the docs call that an implementation detail unsound to rely on), while CYCLE adds a cycle-mark column plus a path column and stops extending any branch whose tracked column values repeat along its path, preventing infinite recursion over cyclic data.

</details>

### `listen-notify` · LISTEN / NOTIFY

**When a NOTIFY is issued inside a transaction, when do listening sessions actually receive it?**

<details><summary>Answer</summary>

Not until — and only if — the transaction commits: a rolled-back NOTIFY is never delivered, which makes notifications safe to pair with the data changes that motivated them. Within one transaction, repeated notifications on the same channel with identical payloads are folded into a single delivered event, and a common pattern is to fire the NOTIFY from a statement trigger on the table being watched so applications cannot forget to signal.

</details>

## Indexing

### `btree-index` · B-tree Index

**What kinds of queries can a B-tree index actually accelerate?**

<details><summary>Answer</summary>

Equality and ordered-range comparisons (<, <=, =, >=, >), plus BETWEEN, IN, IS NULL/IS NOT NULL, and left-anchored LIKE patterns such as 'foo%' — though outside the C locale, that pattern-matching support requires building the index with a special operator class such as text_pattern_ops. It's also PostgreSQL's default index type — CREATE INDEX builds a B-tree unless another type is named — and because entries stay sorted, it can also serve queries that just need data returned in sorted order.

</details>

### `hash-index` · Hash Index

**Why is a hash index more narrowly useful than a B-tree?**

<details><summary>Answer</summary>

It stores only a 32-bit hash of the indexed value, so it can accelerate a plain equality comparison but has no notion of ordering and therefore cannot help with range queries, sorting, or pattern matching the way a B-tree can.

</details>

### `gin-index` · GIN Index

**What kind of data is a GIN index built for?**

<details><summary>Answer</summary>

GIN — a Generalized Inverted Index — stores one entry per component value found inside a composite column, such as each element of an array or each lexeme of a tsvector, so it can quickly answer 'does this row contain X' style queries. That inverted-index structure is exactly what makes it a good fit for jsonb containment checks and full-text search operators.

</details>

### `gist-index` · GiST Index

**What makes GiST different from a single fixed index algorithm like B-tree?**

<details><summary>Answer</summary>

GiST (Generalized Search Tree) is an extensible framework that can host many different indexing strategies rather than one fixed algorithm, which is why it can back geometric containment/overlap queries, range-type queries, and nearest-neighbor searches, all through different operator classes plugged into the same tree structure.

</details>

### `brin-index` · BRIN Index

**When does a BRIN index work well, and why is it so much smaller than a B-tree?**

<details><summary>Answer</summary>

BRIN (Block Range INdex) stores a compact summary — for a linearly ordered type, just the min and max — for each range of physically consecutive table pages, rather than one entry per row. That makes it tiny and cheap to maintain, but it only pays off when a column's values correlate with the physical row order, such as a naturally-inserted timestamp column.

</details>

### `partial-index` · Partial Index

**What problem does a partial index (an index built with a WHERE predicate) solve?**

<details><summary>Answer</summary>

It indexes only the subset of rows that satisfy its predicate, so common values a query wouldn't use the index for anyway are simply left out, shrinking the index and speeding up both the index scans that do use it and the writes that would otherwise keep unnecessary entries updated.

</details>

### `expression-index` · Expression Index

**Why would you index a function or expression instead of a plain column?**

<details><summary>Answer</summary>

An expression index computes and stores the result of a function or expression per row (e.g. lower(email)) so a query filtering on that computed value can be answered as fast as any equality lookup on a plain column, without recomputing the expression at search time. The cost lands on writes instead, since the expression must be recalculated on every insert and non-HOT update.

</details>

### `explain` · EXPLAIN

**What does plain EXPLAIN (without ANALYZE) show, and does it run the query?**

<details><summary>Answer</summary>

It shows the execution plan the planner would use — the chosen scan and join methods, join order, and estimated cost and row counts for each step — without actually running the statement at all, so it has zero side effects even for an INSERT, UPDATE, or DELETE.

</details>

### `explain-analyze` · EXPLAIN ANALYZE

**What is the catch with running EXPLAIN ANALYZE on a data-modifying statement?**

<details><summary>Answer</summary>

Adding ANALYZE makes EXPLAIN genuinely execute the statement so it can report real elapsed time and real row counts next to the planner's estimates — EXPLAIN only ever discards the result rows a SELECT would have returned, it never undoes an underlying write. To inspect an INSERT/UPDATE/DELETE's plan without keeping its effects, wrap it in BEGIN; ... ; ROLLBACK;.

</details>

### `query-planner` · Query Planner

**What does the query planner rely on pg_statistic / pg_stats for?**

<details><summary>Answer</summary>

It uses per-column statistics — most-common values, a histogram of the value distribution, and how many distinct values exist — to estimate how selective a WHERE condition is and therefore how many rows a plan step will produce, which drives its choice between scan methods and join strategies. Those statistics are refreshed by ANALYZE (run manually or by autovacuum), so a table that changed heavily since its last ANALYZE can mislead the planner.

</details>

### `planner-cost-constants` · seq_page_cost / random_page_cost

**What do seq_page_cost and random_page_cost represent?**

<details><summary>Answer</summary>

They're the planner's relative cost estimates for fetching one disk page as part of a sequential scan (seq_page_cost) versus a non-sequential fetch (random_page_cost). Lowering random_page_cost toward seq_page_cost makes the planner favor index scans, while raising it makes index scans look comparatively more expensive; setting the two equal is sensible only when the database is expected to stay entirely cached in RAM, since then there is no penalty for touching pages out of sequence. The server permits values below seq_page_cost, but the docs call that not physically sensible — in a heavily-cached database, lower both values relative to the CPU cost parameters instead.

</details>

### `planner-cost-constants-defaults` · seq_page_cost / random_page_cost

**What are the default values of seq_page_cost and random_page_cost?**

<details><summary>Answer</summary>

seq_page_cost defaults to 1.0 and random_page_cost defaults to 4.0, so the planner charges a random page fetch four times a sequential one. That 4x is not a raw-hardware ratio — truly random access to durable storage costs far more than four times sequential — but a deliberately lowered default reflecting that most random accesses, such as indexed reads, are assumed to hit cache.

</details>

### `multicolumn-index` · Multicolumn Index

**A B-tree index is built on (major, minor). Which query constraints actually narrow the portion of the index scanned, and which just tag along?**

<details><summary>Answer</summary>

The index can be used with any subset of its columns, but equality constraints on the leading (leftmost) columns — plus any inequality constraints on the first column that lacks an equality — are what always limit the portion of the index scanned. Constraints on columns to the right are still checked inside the index, so they always save visits to the table proper, but they don't necessarily reduce the scanned range; multicolumn GIN and BRIN indexes, by contrast, are equally effective regardless of which of their columns the query constrains.

</details>

### `index-only-scan` · Index-Only Scan

**A query reads only columns stored in an index. What still decides whether each row forces a visit to the table heap?**

<details><summary>Answer</summary>

Index entries carry no MVCC visibility information, so an index-only scan checks the visibility map bit for each candidate row's heap page and skips the heap only when that bit says every row on the page is visible to all transactions; otherwise the heap tuple must be fetched anyway. Those bits are set only by vacuum and cleared by any modification to the page, so the technique pays off best on rarely-updated data, and INCLUDE lets non-key 'payload' columns ride along in an index (even a unique one) purely to enable such scans.

</details>

### `bitmap-scan` · Bitmap Scan

**In an EXPLAIN plan, what is a Bitmap Index Scan / Bitmap Heap Scan pair doing that a plain index scan would not?**

<details><summary>Answer</summary>

The lower node scans the index and builds an in-memory bitmap of matching row locations; the upper node sorts those locations into physical order and fetches each needed page once — cheaper than a sequential scan because not every page is visited, and cheaper than row-at-a-time index fetches once too many rows match for scattered random reads. The same bitmap machinery is how PostgreSQL combines multiple indexes in one query, ANDing and ORing their bitmaps — though the index ordering is lost that way, so an ORDER BY then needs its own sort step.

</details>

### `pg-stat-statements` · pg_stat_statements

**How does pg_stat_statements aggregate statistics when the same query runs thousands of times with different constants, and why does enabling it require a restart?**

<details><summary>Answer</summary>

It combines plannable queries (SELECT, INSERT, UPDATE, DELETE, MERGE) that share an identical query structure into a single entry identified by a queryid hash, replacing the ignored constants with placeholders like $1 in the displayed text; each entry accumulates calls, total execution time, rows, and block-I/O counters such as shared_blks_hit — planning time too, but only if pg_stat_statements.track_planning is enabled, since it defaults to off. Because the module needs additional shared memory, it must be listed in shared_preload_libraries, so adding or removing it takes a server restart — which is what makes it the standard always-on tool for finding a workload's most expensive statements.

</details>

### `hot-update` · Heap-Only Tuple (HOT)

**What two conditions allow an UPDATE to be a heap-only tuple (HOT) update, and what work does that avoid?**

<details><summary>Answer</summary>

The update must not change any column referenced by the table's indexes (summarizing indexes such as BRIN excepted), and the new row version must fit on the same page as the old one. When both hold, no new index entries are created, and intermediate row versions can be pruned away during normal operation — even by plain SELECTs — instead of waiting for vacuum; lowering a table's fillfactor leaves free space on each page precisely to make HOT updates more likely.

</details>

### `reindex-concurrently` · REINDEX

**When is REINDEX called for, and what does adding CONCURRENTLY change?**

<details><summary>Answer</summary>

REINDEX rebuilds an index that has become bloated with empty or nearly-empty pages, corrupted, or left invalid by a failed CREATE INDEX CONCURRENTLY. A plain REINDEX locks out writes to the parent table (reads continue) and blocks queries that would use the index being rebuilt, whereas REINDEX CONCURRENTLY takes no lock that prevents concurrent inserts, updates, or deletes — at the cost of more total work, a significantly longer runtime, and the chance of leaving behind an additional invalid index if it fails partway.

</details>

## Transactions

### `mvcc` · MVCC

**What problem does Multiversion Concurrency Control solve, and how?**

<details><summary>Answer</summary>

Instead of readers and writers locking each other out, MVCC hands each query a fixed snapshot of the data — taken at statement start under Read Committed, or once at the transaction's first query under the stricter levels — so concurrent updates elsewhere can never make it see a half-finished change. Because locks acquired for reading never conflict with locks acquired for writing, reading never blocks writing and writing never blocks reading.

</details>

### `isolation-level` · Isolation Level

**How many distinct isolation levels does PostgreSQL actually implement, versus how many the SQL standard defines?**

<details><summary>Answer</summary>

The SQL standard defines four (Read Uncommitted, Read Committed, Repeatable Read, Serializable), but PostgreSQL implements only three distinct behaviors internally — a request for Read Uncommitted is silently treated the same as Read Committed, since that is the only sensible mapping onto PostgreSQL's MVCC design.

</details>

### `read-committed` · Read Committed

**What does a SELECT see under PostgreSQL's Read Committed isolation level?**

<details><summary>Answer</summary>

Each individual statement — not the whole transaction — gets a fresh snapshot taken as of the moment that statement starts, so it sees anything committed before that instant, including changes other transactions committed in between two statements of the same transaction. This is PostgreSQL's default isolation level.

</details>

### `repeatable-read` · Repeatable Read

**What guarantee does Repeatable Read add on top of Read Committed?**

<details><summary>Answer</summary>

The snapshot is taken once, at the transaction's first non-transaction-control statement (its first real query, not BEGIN itself), and held for every statement in it, so the same query run twice in that transaction sees an identical view of the data regardless of what other transactions commit in the meantime. PostgreSQL implements this as Snapshot Isolation, and an update that would conflict with a since-changed row raises a serialization error instead of silently overwriting it.

</details>

### `serializable` · Serializable

**How does PostgreSQL's Serializable isolation level go beyond Repeatable Read?**

<details><summary>Answer</summary>

It behaves exactly like Repeatable Read but additionally watches for patterns of read/write dependencies across concurrent transactions that could produce a result inconsistent with any possible one-at-a-time (serial) execution order, and aborts one of the involved transactions with a serialization failure when it detects one. This is PostgreSQL's Serializable Snapshot Isolation (SSI).

</details>

### `row-lock` · Row Lock

**What do row-level lock modes like FOR UPDATE and FOR SHARE actually block?**

<details><summary>Answer</summary>

They block other transactions from acquiring a conflicting lock, updating, or deleting that same row, but they never block plain reads, since row-level locking only ever affects writers and other lockers of the same row. FOR UPDATE is the strongest of the four row-lock modes; each step down toward the weakest, FOR KEY SHARE, conflicts with fewer other lock holders.

</details>

### `table-lock` · Table Lock

**Why can an ACCESS EXCLUSIVE table lock block a plain SELECT when weaker table locks cannot?**

<details><summary>Answer</summary>

PostgreSQL's table-level lock modes form a conflict matrix, and ACCESS EXCLUSIVE is the only one that conflicts even with ACCESS SHARE — the lock an ordinary read acquires — so it's the only table lock strong enough to block a plain SELECT. Most DML commands only take the much weaker ROW EXCLUSIVE lock, which does not conflict with reads at all.

</details>

### `advisory-lock` · Advisory Lock

**A session holds pg_advisory_lock(42). What stops another session from writing the rows that lock is meant to protect?**

<details><summary>Answer</summary>

Nothing — an advisory lock has an application-defined meaning that PostgreSQL itself never enforces; cooperating sessions simply agree to check it.

</details>

### `advisory-lock-scopes` · Advisory Lock

**What are the two ways to hold a PostgreSQL advisory lock, and when does each release?**

<details><summary>Answer</summary>

A session-level advisory lock stays held until the process releases it on purpose or its session ends — even a rolled-back transaction that acquired it won't let it go — while a transaction-level lock instead drops away automatically the instant its own transaction finishes, with no explicit unlock call needed, which is usually more convenient for short-lived use.

</details>

### `deadlock` · Deadlock

**How does PostgreSQL respond when it detects a deadlock?**

<details><summary>Answer</summary>

It automatically detects the cycle — for example, transaction A holding a lock transaction B wants while B holds a lock A wants — and resolves it by aborting one of the involved transactions so the other(s) can proceed; which one gets aborted is not something you should rely on. Deadlocks can arise purely from row-level locks, without any explicit LOCK statement.

</details>

### `serialization-failure` · Serialization Failure (SSI)

**What SQLSTATE code identifies a serialization failure, and what should an application do about it?**

<details><summary>Answer</summary>

Serialization failures under Repeatable Read or Serializable isolation always carry SQLSTATE 40001, and the documented response is to retry the entire transaction, including whatever application logic decided which SQL to run, since PostgreSQL has no way to safely automate that retry itself. Deadlock failures (40P01) are also advisable to retry, and in some cases so are unique-key (23505) and exclusion-constraint (23P01) violations, since those can be serialization anomalies the server does not recognize as such.

</details>

### `snapshot` · Snapshot

**What is a "snapshot" in PostgreSQL's MVCC model?**

<details><summary>Answer</summary>

A snapshot is the set of transactions considered already-committed (and therefore visible) as of a particular moment, which is what lets a query see a consistent view of the database as it looked then, regardless of what concurrent transactions are doing to the underlying rows right now. Read Committed takes a new snapshot per statement; Repeatable Read and Serializable freeze one snapshot at their first real statement and reuse it for the whole transaction.

</details>

### `isolation-phenomena` · Isolation Phenomena

**Which four phenomena does PostgreSQL's documentation use to characterize the transaction isolation levels, and which of them come from the SQL standard?**

<details><summary>Answer</summary>

Dirty read — reading data written by a concurrent uncommitted transaction (never possible in PostgreSQL at any level); nonrepeatable read — re-reading data and finding it modified by another transaction that committed since the first read; phantom read — re-running a search and finding the set of qualifying rows changed by another recently-committed transaction; and serialization anomaly — a committed group of transactions whose result is inconsistent with every possible one-at-a-time ordering of them. Only the first three come from the SQL standard, which uses them to define the three weaker levels; Serializable is instead defined directly as guaranteeing the same effect as running the transactions one at a time in some order, and serialization anomaly is PostgreSQL's documented name for violating that.

</details>

### `truncate-mvcc` · MVCC Caveats

**After another session commits a TRUNCATE, why can a concurrent transaction with an older snapshot suddenly see the table as empty?**

<details><summary>Answer</summary>

TRUNCATE and the table-rewriting forms of ALTER TABLE are not MVCC-safe: once such a command commits, the table appears empty even to transactions whose snapshot predates it. The exposure is limited to transactions that had not yet touched the table before the DDL started — any that had would hold at least an ACCESS SHARE lock, blocking the DDL until they finish — and this MVCC violation is the accepted price of TRUNCATE removing all rows instantly instead of leaving dead versions for VACUUM.

</details>

### `session-timeouts` · Timeout Settings

**Which timeout guards against a session sitting idle inside an open transaction, and how do statement_timeout and lock_timeout divide the other failure modes?**

<details><summary>Answer</summary>

idle_in_transaction_session_timeout terminates any session that sits idle within an open transaction longer than the limit, so a forgotten transaction cannot hold locks indefinitely or block vacuum from cleaning up tuples only it could see. statement_timeout aborts any statement that runs longer than its limit, while lock_timeout fires only when a statement has waited that long trying to acquire a lock (checked separately for each lock acquisition), and transaction_timeout caps a transaction's total duration regardless of activity. All of them default to 0 (disabled), and the docs advise against setting statement_timeout, lock_timeout, or transaction_timeout server-wide in postgresql.conf because that would affect every session.

</details>

## Administration

### `role` · Role

**What is a PostgreSQL role, and how does it relate to a "user"?**

<details><summary>Answer</summary>

A role is the single underlying primitive for both users and groups: it can own objects, hold privileges, and optionally have LOGIN rights that let it connect as a client. A "user" is simply a role created with login capability, and roles can be granted membership in other roles to build group-style permission structures.

</details>

### `schema` · Schema

**What is a schema, and what does search_path control?**

<details><summary>Answer</summary>

A schema is a named namespace inside a database that holds tables, views, functions, and other objects, letting two same-named tables coexist in one database as long as they live in different schemas; every database starts with a default public schema. search_path lists the schemas checked, in order, for an unqualified object name, and the first schema in it that exists is also where new unqualified objects get created.

</details>

### `vacuum` · VACUUM

**Why does PostgreSQL need VACUUM at all, given MVCC?**

<details><summary>Answer</summary>

An UPDATE or DELETE never removes the old row version immediately — MVCC requires keeping it as long as some other transaction's snapshot might still need to see it — so dead row versions pile up over time. VACUUM scans a table, removes dead row versions no longer visible to anyone, and marks that space available for reuse by future rows — the file itself doesn't shrink, except in the special case where entirely-empty pages at the very end of the table can be truncated off and that space returned to the operating system when an exclusive lock is easily obtained.

</details>

### `vacuum-vs-analyze` · VACUUM vs. ANALYZE

**Between VACUUM and ANALYZE, which one reclaims dead tuple space, and which one refreshes the planner's statistics?**

<details><summary>Answer</summary>

VACUUM reclaims the space held by dead row versions so future writes can reuse it, generally without shrinking the file on disk (only entirely-free trailing pages can be truncated and returned to the OS). ANALYZE does a completely different job: it samples the table's current contents to refresh the statistics the query planner relies on — the row-count estimate in pg_class and per-column value distributions in pg_statistic. Running VACUUM ANALYZE, or letting autovacuum do both, covers space reclamation and planner accuracy in one pass, but neither command substitutes for the other.

</details>

### `vacuum-full` · VACUUM FULL

**How does VACUUM FULL differ from plain VACUUM in what it does and what it costs?**

<details><summary>Answer</summary>

Rather than just marking dead space reusable in place, VACUUM FULL writes an entirely new copy of the table with no wasted space and swaps it in, which actually shrinks the file and returns space to the operating system — but it requires an ACCESS EXCLUSIVE lock for the whole operation, blocking all other access to the table, and needs roughly double the disk space while it runs. Autovacuum never issues VACUUM FULL on its own.

</details>

### `autovacuum` · Autovacuum

**What triggers the autovacuum daemon to vacuum a particular table?**

<details><summary>Answer</summary>

It compares the number of rows updated or deleted since the last vacuum against a threshold of autovacuum_vacuum_threshold plus autovacuum_vacuum_scale_factor times the table's row count (50 plus 20% by default, and since PostgreSQL 18 capped by autovacuum_vacuum_max_threshold, 100 million by default). A separate insert-count threshold triggers vacuums on insert-only tables too, and any table whose relfrozenxid age passes autovacuum_freeze_max_age is vacuumed regardless of either threshold — so autovacuum reacts to actual write activity rather than a fixed calendar schedule.

</details>

### `pg-dump` · pg_dump / pg_dumpall

**What is the difference between pg_dump and pg_dumpall?**

<details><summary>Answer</summary>

pg_dump backs up a single database's contents, either as a plain SQL script or as an archive format (custom, directory, or tar) that pairs with pg_restore for selective restores — parallel restore with -j requires custom or directory. pg_dumpall instead calls pg_dump for every database in the cluster and adds the cluster-wide global objects — roles, tablespaces, and parameter-level privilege grants — that pg_dump alone never captures, but it only produces a plain-text script.

</details>

### `pg-restore` · pg_restore

**What can pg_restore do that simply piping a plain-text pg_dump script into psql cannot?**

<details><summary>Answer</summary>

Because pg_restore reads one of pg_dump's archive formats (custom, directory, or tar) rather than a flat SQL script, it can selectively restore just some objects, reorder what gets restored, and — for both the custom and directory formats — run the restore in parallel across multiple jobs (-j), none of which is possible once a dump has been reduced to a plain-text script.

</details>

### `wal-archiving` · WAL Archiving

**What does enabling WAL archiving actually do, mechanically?**

<details><summary>Answer</summary>

With wal_level set to at least replica, archive_mode on, and an archive_command configured, PostgreSQL invokes that command on each completed WAL segment file so a copy is saved somewhere durable — the basis for point-in-time recovery, since replaying archived WAL past a base backup can restore the database to any moment covered by the archive.

</details>

### `pg-basebackup` · pg_basebackup

**What does pg_basebackup produce, and what is it used for?**

<details><summary>Answer</summary>

It takes a full (or, for supported versions, block-level incremental) physical copy of a running cluster's data files without interrupting other clients, usable either as the starting point for point-in-time recovery or to seed a new streaming-replication standby. It can even take that backup from an already-running standby server rather than only from the primary.

</details>

### `extension` · Extension

**What problem does packaging database objects as an extension solve?**

<details><summary>Answer</summary>

An extension bundles a related set of SQL objects — functions, types, operators, index operator classes — behind a single CREATE EXTENSION / DROP EXTENSION pair, driven by a control file and one or more SQL script files, so the database understands they belong together. pg_dump then just records the CREATE EXTENSION command instead of dumping every member object individually, which greatly simplifies upgrading to a newer extension version.

</details>

### `declarative-partitioning` · Declarative Partitioning

**What are the three built-in partitioning strategies for a declaratively partitioned table?**

<details><summary>Answer</summary>

Range partitioning assigns non-overlapping value ranges (inclusive lower bound, exclusive upper bound) to each partition; list partitioning assigns an explicit list of key values to each partition; hash partitioning assigns rows by the remainder of the partition key's hash value modulo a chosen modulus. The partitioned table itself holds no data — all storage belongs to its child partitions, and PostgreSQL automatically routes each inserted row to the matching one.

</details>

### `tablespace` · Tablespace

**What is a tablespace, and why might an administrator create more than one?**

<details><summary>Answer</summary>

A tablespace maps a name to a physical directory on disk, and CREATE TABLE ... TABLESPACE (or the default_tablespace setting) controls which one a table, index, or database's files live in. A common reason to use several is to put heavily-used objects on faster storage while less performance-critical or rarely-touched data sits on cheaper, slower disks.

</details>

### `grant-revoke` · GRANT / REVOKE

**What do GRANT and REVOKE control?**

<details><summary>Answer</summary>

GRANT hands a role a specific privilege — such as SELECT, INSERT, UPDATE, DELETE, or EXECUTE — on a database object, optionally WITH GRANT OPTION so that role can in turn grant it to others; REVOKE removes a previously granted privilege. Object owners and superusers can grant and revoke privileges on the objects they control.

</details>

### `predefined-role` · Predefined Role

**What do PostgreSQL's built-in predefined roles like pg_read_all_data and pg_monitor let an administrator do?**

<details><summary>Answer</summary>

They are ready-made roles that bundle together a set of narrowly-scoped privileges — pg_read_all_data grants SELECT on every table/view/sequence plus USAGE on every schema, pg_monitor bundles read access to settings and statistics views — so an administrator can grant one predefined role instead of hand-assembling broad access from many individual GRANT statements, without ever handing out full superuser rights.

</details>

### `sequence` · Sequence

**What does CREATE SEQUENCE create, and how do nextval/currval/setval interact with it?**

<details><summary>Answer</summary>

It creates a standalone number generator object, independent of any particular table column, though OWNED BY can tie its lifetime to one so dropping that column drops the sequence too. nextval() advances the sequence and returns the new value, currval() returns the value most recently obtained by the current session, and setval() explicitly resets the counter.

</details>

### `trigger` · Trigger

**What do the BEFORE / AFTER / INSTEAD OF timing options and FOR EACH ROW / FOR EACH STATEMENT options control on a trigger?**

<details><summary>Answer</summary>

BEFORE fires before the row change is applied and can modify or cancel it; AFTER fires once the change (and any constraint checks) has completed, when every effect is already visible; INSTEAD OF replaces the operation entirely and is how complex views that aren't automatically updatable become writable. FOR EACH ROW runs the trigger function once per affected row, while FOR EACH STATEMENT runs it exactly once per statement regardless of how many rows were touched.

</details>

### `view` · View

**Why doesn't a view's data get physically stored anywhere, and what does PostgreSQL do instead each time it's queried?**

<details><summary>Answer</summary>

CREATE VIEW just saves the query definition, and PostgreSQL re-runs that underlying query every time the view is referenced, so it always reflects the current data in the base tables. A sufficiently simple view (a single base relation in its FROM list, among other conditions) is even automatically updatable: INSERT/UPDATE/DELETE against it get translated into the equivalent statement on the underlying table.

</details>

### `materialized-view` · Materialized View

**How does a materialized view differ from a regular view, and how do you keep it current?**

<details><summary>Answer</summary>

Unlike a regular view, a materialized view actually persists its query's result set to disk the way a table does, so reading from it can be much faster than re-running the underlying query — but that means the data can go stale. Running REFRESH MATERIALIZED VIEW re-executes the stored query and replaces the persisted contents; nothing refreshes it automatically.

</details>

### `txid-wraparound` · Transaction ID Wraparound

**Why must every table be vacuumed at least occasionally, even one that is never updated or deleted?**

<details><summary>Answer</summary>

Transaction IDs are 32-bit and compared in circular modulo-2^32 fashion, so for any XID about two billion count as older and two billion as newer — left alone, rows written more than two billion transactions ago would abruptly appear to be in the future and their contents become invisible, which the documentation calls catastrophic data loss. VACUUM prevents this by freezing sufficiently old rows — treating them as if inserted by the special FrozenTransactionId, which is always older than every normal XID — so even an insert-only table needs periodic vacuuming to advance its relfrozenxid.

</details>

### `anti-wraparound-autovacuum` · Anti-Wraparound Vacuum

**What happens when a table's oldest unfrozen XID age passes autovacuum_freeze_max_age — and does disabling autovacuum prevent it?**

<details><summary>Answer</summary>

Autovacuum launches an aggressive vacuum on that table to freeze its old rows even if autovacuum is disabled — this anti-wraparound safety net cannot be switched off, and the parameter defaults to 200 million transactions. If the oldest XIDs still drift to within about 3 million transactions of wraparound (after warnings that begin around 40 million out), the database refuses commands that assign new XIDs until VACUUM is run in that database — a database-wide plain VACUUM is simplest, and notably VACUUM FULL is the wrong tool here because it needs an XID itself.

</details>

### `pg-hba-conf` · pg_hba.conf

**How does PostgreSQL decide which pg_hba.conf record applies to an incoming connection?**

<details><summary>Answer</summary>

Records are checked in order against the connection's type, requested database, user, and client address, and the first matching record is used — there is no fall-through, so if authentication under that record fails, later records are never consulted, and if no record matches at all the connection is refused. Edits only take effect once the configuration is reloaded, via pg_ctl reload or SELECT pg_reload_conf().

</details>

### `scram-authentication` · Password Authentication

**Why is scram-sha-256 preferred over the md5 and password authentication methods?**

<details><summary>Answer</summary>

It is a challenge-response scheme that prevents password sniffing on untrusted connections and stores only a cryptographically hashed form of the password on the server, whereas md5 uses a weaker custom challenge-response whose stolen server-side hash gives an attacker everything, and password transmits the password in clear text. The documentation calls scram-sha-256 the most secure of the provided password methods, and md5 support is deprecated for future removal.

</details>

### `pg-stat-activity` · pg_stat_activity

**In pg_stat_activity, what distinguishes the states active, idle, and idle in transaction — and which one is the operational red flag?**

<details><summary>Answer</summary>

The view shows one row per server process: active means the backend is executing a query, idle means it is waiting for its client's next command, and idle in transaction means it sits inside an open transaction while running nothing — the red-flag state, since it can hold locks and pin the cleanup horizon indefinitely. For any state other than active, the query column shows that backend's most recently executed query, not something currently running.

</details>

### `cancel-vs-terminate-backend` · pg_cancel_backend / pg_terminate_backend

**When must you use pg_terminate_backend rather than pg_cancel_backend, and who is allowed to call them?**

<details><summary>Answer</summary>

pg_cancel_backend cancels only the target session's currently running query and leaves the connection alive, so it does nothing for a session that is idle in transaction — ending that session takes pg_terminate_backend, which terminates the whole backend. Both are available to superusers, to members of the role the backend belongs to, and to roles granted pg_signal_backend; a true result only means the signal was sent, unless terminate's timeout argument is used to wait for actual exit.

</details>

### `bulk-loading-copy` · Bulk Loading

**What is the documented fastest way to populate a freshly created table, and what step should always follow a large bulk load?**

<details><summary>Answer</summary>

Create the table, load it with COPY — almost always faster than INSERT even when statements are prepared and batched into a single transaction — and only then create indexes and add foreign keys, since building an index on pre-existing data beats updating it row by row, and loading through an existing foreign key queues a pending trigger event per row that on multi-million-row loads can overflow memory and force you to drop and re-apply the constraint. Temporarily raising maintenance_work_mem speeds those deferred CREATE INDEX and ADD FOREIGN KEY steps (it does nothing for COPY itself), raising max_wal_size reduces forced checkpoints during the load, and under wal_level=minimal a COPY into a table created or truncated in the same transaction skips WAL entirely, relying on an fsync at the end for crash safety. Afterward, run ANALYZE (or VACUUM ANALYZE) so the planner works from statistics that reflect the newly loaded data.

</details>

### `parameter-setting-layers` · Parameter Settings

**When the same parameter is set in postgresql.conf, via ALTER SYSTEM, via ALTER DATABASE/ROLE, and via SET, which value wins and when does each apply?**

<details><summary>Answer</summary>

postgresql.conf is the base; ALTER SYSTEM records overrides in postgresql.auto.conf, which is read alongside it and takes precedence; ALTER DATABASE and ALTER ROLE store per-database and per-role defaults that apply only to freshly started sessions; and SET (or SET LOCAL) overrides the value for just the current session or transaction. File-level changes take effect when the postmaster receives SIGHUP — sent with pg_ctl reload or pg_reload_conf(), and propagated to running backends so existing sessions adopt the new values — though parameters that can only be set at server start, such as wal_level, ignore any change until an actual restart; SHOW reports whatever value is currently in effect.

</details>

### `partition-pruning` · Partition Pruning

**At which points in a query's lifetime can partitions be pruned from the plan, and what information does the pruning decision rely on?**

<details><summary>Answer</summary>

The planner compares the query's conditions against each partition's declared bounds and removes any partition that provably cannot contain matching rows — relying only on the constraints implicit in the partition key declaration, not on any indexes, so it works even on unindexed partitions. Pruning happens at plan time when the comparison values are known then, but can also happen during execution for values that only appear at run time, such as parameters bound through PREPARE, values from subqueries, or the inner side of a parameterized nested-loop join. The whole mechanism is governed by enable_partition_pruning, which is on by default.

</details>

### `role-attributes-inheritance` · Role Membership

**A role holds an inheriting membership in a role that has CREATEDB. Why can it still not run CREATE DATABASE directly?**

<details><summary>Answer</summary>

Membership inheritance covers only ordinary privileges on database objects; the role attributes LOGIN, SUPERUSER, CREATEDB, and CREATEROLE are never inherited. To exercise one, the member must first switch into the attribute-holding role with SET ROLE — allowed whenever the membership chain was granted with the SET option, which is the default — making use of powerful attributes a deliberate act rather than an ambient power.

</details>

### `row-level-security` · Row-Level Security

**What happens to queries the moment ROW LEVEL SECURITY is enabled on a table with no policies yet — and who is exempt?**

<details><summary>Answer</summary>

A default-deny policy takes over: no rows are visible or modifiable through normal access until CREATE POLICY grants some back, with a policy's USING expression filtering which existing rows are visible and its WITH CHECK expression validating rows being inserted or updated. Superusers and roles carrying the BYPASSRLS attribute always bypass row security, and table owners do too unless the table is set to FORCE ROW LEVEL SECURITY.

</details>

### `pg-upgrade` · pg_upgrade

**Why can pg_upgrade move a cluster to a new major version without a dump and restore, and what is the catch with --link mode?**

<details><summary>Answer</summary>

Major releases regularly change system-table layouts but rarely the internal data storage format, so pg_upgrade simply builds fresh system catalogs and reuses the old user data files — dramatically faster than dumping and reloading. With --link it hard-links those files instead of copying, making the upgrade faster still with almost no extra disk, but once the new cluster starts the old cluster can no longer be used; minor-version upgrades never need pg_upgrade at all.

</details>

## Replication

### `streaming-replication` · Streaming Replication

**What is streaming replication, at a mechanical level?**

<details><summary>Answer</summary>

A standby's WAL receiver process connects to the primary and continuously streams newly-generated WAL records over the network as they're produced, replaying them to stay caught up, rather than waiting for whole WAL segment files to be archived and shipped. That is what makes streaming replication capable of much lower replica lag than file-based log shipping.

</details>

### `logical-replication` · Logical Replication

**How does logical replication differ from PostgreSQL's physical (streaming) replication?**

<details><summary>Answer</summary>

Physical replication ships exact block-level byte changes and requires the standby to be a full byte-identical copy of the whole cluster; logical replication instead replicates data changes at the level of individual rows, identified by something like a primary key, using a publish/subscribe model. That row-level granularity is what lets logical replication selectively replicate just some tables or replicate between different major PostgreSQL versions.

</details>

### `publication` · Publication

**What is a publication, and where does it live?**

<details><summary>Answer</summary>

A publication, created with CREATE PUBLICATION on the source (publisher) node, defines a set of changes — from one table, several tables, or every table in the database (FOR ALL TABLES) — that subscribers can subscribe to. It exists inside exactly one database, and a single publisher can define multiple publications for different subsets of its data.

</details>

### `subscription` · Subscription

**What does a subscription do, and how is it linked to a publication?**

<details><summary>Answer</summary>

Created on the receiving (subscriber) side with CREATE SUBSCRIPTION, a subscription stores the connection details for the publisher database plus the list of publications it wants to receive changes from, and it pulls those changes continuously through a dedicated replication slot on the publisher.

</details>

### `replication-slot` · Replication Slot

**What problem does a replication slot solve for a standby or logical subscriber?**

<details><summary>Answer</summary>

A replication slot tells the sending server to retain WAL (and, for logical slots, the catalog state needed for decoding) for exactly as long as that particular consumer still needs it, even across a disconnect, preventing WAL from being recycled before a lagging standby or subscriber has consumed it. The tradeoff is that a slot whose consumer stops connecting can make WAL, or table bloat, accumulate indefinitely on the sender.

</details>

### `standby-modes` · Hot Standby / Warm Standby

**What is the difference between a warm standby and a hot standby?**

<details><summary>Answer</summary>

Both continuously replay incoming WAL to stay nearly caught up with the primary, which is what makes either a fast failover target — that continuous replay is the 'warm' part. A hot standby goes further by also accepting client connections and serving read-only queries while it keeps replaying, something a purely warm standby does not do.

</details>

### `failover` · Failover

**What is failover, and what does PostgreSQL itself provide versus what you have to supply?**

<details><summary>Answer</summary>

Failover is promoting a standby to take over as the new primary after the original primary fails. PostgreSQL provides the promotion mechanism itself (pg_ctl promote or pg_promote()), but it does not provide the failure-detection or automatic-triggering layer — identifying that the primary is actually down and deciding to initiate failover is left to external tooling.

</details>

### `pg-promote` · pg_promote

**What does calling pg_promote() do?**

<details><summary>Answer</summary>

It's the SQL-callable way to trigger failover on a standby: by default it waits (up to wait_seconds, 60 by default) until promotion to primary completes and returns whether it succeeded, or with wait set to false it just signals the postmaster and returns immediately without waiting to confirm. It is restricted to superusers unless EXECUTE is explicitly granted to another role.

</details>

### `connection-pooling` · Connection Pooling (PgBouncer)

**Why use a connection pooler like PgBouncer instead of connecting application processes to PostgreSQL directly?**

<details><summary>Answer</summary>

Each PostgreSQL backend process is relatively expensive to spawn and hold open, so a pooler like PgBouncer maintains a small set of real server connections and hands them out to many client connections as needed. Its pool_mode controls how eagerly a server connection is returned to the pool: session mode holds it for the whole client session, transaction mode returns it as soon as each transaction finishes, and statement mode returns it after every single query.

</details>

### `synchronous-replication` · Synchronous Replication

**What does synchronous replication guarantee that plain (asynchronous) streaming replication does not?**

<details><summary>Answer</summary>

With synchronous_standby_names configured, a transaction's commit does not return to the client until the required number of listed standby servers have confirmed they've received (and, depending on synchronous_commit, written or applied) its WAL, so data can only be lost if the primary and every synchronous standby fail at the same moment. That extra durability comes at the cost of added commit latency, at minimum the round-trip time to the standby.

</details>

### `replica-identity` · Replica Identity

**Why does logical replication require a published table to have a replica identity before UPDATE or DELETE operations can be replicated?**

<details><summary>Answer</summary>

The publisher logs the identity columns' old values so the subscriber can locate the matching row to change: by default the primary key serves, a unique index can be nominated with ALTER TABLE ... REPLICA IDENTITY USING INDEX, and REPLICA IDENTITY FULL falls back to treating the entire row as the key — correct but potentially very inefficient to match on the subscriber, so it's a last resort. Without a usable identity, UPDATE and DELETE on the published table fail with an error on the publisher, while INSERTs proceed regardless.

</details>

### `logical-replication-restrictions` · Logical Replication Limits

**What does logical replication leave out, and which omission must be fixed by hand before a subscriber can be promoted to accept writes?**

<details><summary>Answer</summary>

DDL is never replicated — schema changes must be applied to the subscriber manually, and if replicated data arrives that no longer fits the subscriber's schema, replication errors and halts until the two are reconciled — and large objects are not replicated at all, with no workaround beyond storing that data in ordinary tables. Sequence state is the failover trap: serial and identity column values travel as ordinary row data, but the subscriber's sequence objects keep their start values, so before promoting a subscriber its sequences must be advanced past the replicated data or new inserts will collide with existing keys. Replication is also only supported for tables, including partitioned tables — attempting to replicate a view, materialized view, or foreign table results in an error.

</details>

### `recovery-conflict` · Recovery Conflict

**Why can a long-running read-only query on a hot standby get canceled through no fault of its own, and what does hot_standby_feedback trade away?**

<details><summary>Answer</summary>

Incoming WAL can conflict with running standby queries — most commonly a VACUUM cleanup record removing row versions a standby snapshot can still see, or an ACCESS EXCLUSIVE lock taken by DDL on the primary — and since the standby must apply that WAL, it waits up to max_standby_streaming_delay (or max_standby_archive_delay for archived WAL) and then cancels the conflicting queries. hot_standby_feedback eliminates the cleanup class of conflict by telling the primary which row versions standby queries still need, at the cost of delaying dead-row cleanup there, which can show up as table bloat on the primary.

</details>

### `hot-standby-limits` · Hot Standby Queries

**Which seemingly read-only operations fail on a hot standby?**

<details><summary>Answer</summary>

Standby transactions can never write WAL or take a transaction ID, so SELECT ... FOR UPDATE/FOR SHARE, temporary-table creation, LISTEN/NOTIFY, and nextval()/setval() are all rejected, and the strictest isolation level available is Repeatable Read, not Serializable. Plain reads all work, but they run under the visibility rules of the WAL replay position — and can still fall victim to recovery conflicts.

</details>

### `wal-level` · wal_level

**What do the three wal_level settings — minimal, replica, and logical — each make possible?**

<details><summary>Answer</summary>

minimal logs only what crash recovery needs, which lets some bulk operations skip row-level WAL but rules out archiving and replication — the server will not even start at this level with max_wal_senders non-zero. replica, the default, writes enough for WAL archiving, physical replication, and read-only queries on a standby, and logical adds on top of that the information logical decoding needs, at the cost of extra WAL volume; each level includes everything the levels below it log.

</details>

### `pg-rewind` · pg_rewind

**After a failover, why reach for pg_rewind instead of rebuilding the old primary from a fresh base backup?**

<details><summary>Answer</summary>

pg_rewind resynchronizes a data directory with another copy of the same cluster after their timelines have diverged, copying only the relation blocks that actually changed, so on a large database it is far faster than re-seeding with pg_basebackup. It requires the target server to have been shut down cleanly, either wal_log_hints enabled or data checksums on, and WAL reaching back to the divergence point — after which the rewound server can rejoin as a standby following the new primary.

</details>
