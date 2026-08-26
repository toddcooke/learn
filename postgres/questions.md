# PostgreSQL — question bank

154 questions. Answers are collapsed; expand to check yourself.

## Architecture & Data Types

24 questions

### architecture-001

In PostgreSQL's client/server process model, what happens when a new client connects to the server?

- **A.** The client connects directly to an existing backend process that is already serving another client.
- **B.** The postmaster spawns a new thread within its own process to handle the connection.
- **C.** The postmaster forks a new backend process dedicated to that one connection.
- **D.** The postmaster handles every subsequent query for that client itself, without creating any new process.

<details><summary>Answer</summary>

**C.** — The postmaster listens for connections and forks a dedicated backend process per client; from then on, that backend handles the session directly while the postmaster returns to listening for the next connection.

</details>

### architecture-002

According to PostgreSQL's write-ahead logging design, why does committing a transaction typically require flushing only the WAL rather than every changed data page?

- **A.** Because flushing the sequential WAL is cheaper than flushing data pages, and any gap can be redone from WAL.
- **B.** Because data pages are never written to disk until the database is shut down cleanly.
- **C.** Because WAL records are stored only in memory and are never themselves flushed to permanent storage.
- **D.** Because PostgreSQL disables all disk writes during a transaction and batches them once per checkpoint regardless of WAL.

<details><summary>Answer</summary>

**A.** — WAL guarantees durability by requiring change records to be flushed before the corresponding data page reaches disk, so only the sequentially-written WAL needs syncing at commit time; a crash can be recovered by replaying WAL records forward.

</details>

### architecture-003

For a dedicated PostgreSQL server with at least 1GB of RAM, what does the documentation suggest as a reasonable starting point for shared_buffers, and why does going far beyond it tend not to help?

- **A.** Roughly 90% of system RAM, since shared_buffers is the only cache PostgreSQL uses and the OS cache plays no role.
- **B.** A fixed 8MB regardless of total system memory, since shared_buffers cannot be resized without recompiling the server.
- **C.** Roughly 25% of system RAM, because values above that cause PostgreSQL to disable checkpointing entirely.
- **D.** Roughly 25% of RAM, since the OS filesystem cache absorbs the rest and pushing past 40% rarely helps.

<details><summary>Answer</summary>

**D.** — shared_buffers is commonly started around a quarter of system RAM because the operating system's own page cache already absorbs a large share of caching duties, so pushing shared_buffers much higher usually yields diminishing returns.

</details>

### architecture-004

Which of the following statements about the work_mem configuration parameter are accurate? *(choose two)*

- **A.** work_mem sets a hard cap on the total memory a single client connection may use for the lifetime of that connection.
- **B.** work_mem caps the memory a single sort or hash operation may use before spilling to temporary disk files.
- **C.** work_mem is used only by ORDER BY sorts and has no effect on hash joins or hash-based aggregation.
- **D.** Because a query can run multiple sort or hash operations at once, and many sessions can run concurrently, total memory used across the server can be many times the configured work_mem value.
- **E.** Raising work_mem guarantees that PostgreSQL will never write temporary sort or hash data to disk, regardless of query complexity.

<details><summary>Answer</summary>

**B.** **D.** — work_mem bounds each individual sort or hash step rather than a session as a whole, and since a query can run several such operations at once while many sessions run concurrently, aggregate memory use can end up a large multiple of the setting.

</details>

### architecture-005

A server is configured with max_connections = 100 and superuser_reserved_connections = 3. At what point does a new non-superuser connection attempt start being rejected?

- **A.** Only once all 100 slots are occupied — the three reserved slots exist on top of max_connections, so up to 103 sessions can be active when superusers use them.
- **B.** As soon as 97 connections are active, since new connections are accepted only for superusers once the active count reaches max_connections minus superuser_reserved_connections.
- **C.** It is never rejected outright; the postmaster queues the attempt until one of the unreserved slots frees up.
- **D.** Only once all 100 slots are occupied, at which point superusers may still connect by exceeding max_connections by up to three extra sessions.

<details><summary>Answer</summary>

**B.** — The reserved slots are carved out of max_connections rather than added on top of it: whenever the number of active connections is at least max_connections minus superuser_reserved_connections (97 here), new connections are accepted only for superusers, preserving an administrator's ability to log in and diagnose a server whose ordinary slots are exhausted. At most max_connections sessions can ever be active simultaneously — superusers cannot push past the cap — and a rejected attempt fails immediately rather than being queued.

</details>

### architecture-006

Why can't you safely assume that a table's on-disk filename always matches its OID in pg_class?

- **A.** Because PostgreSQL renames every table's file to a random name each time autovacuum runs.
- **B.** Because TRUNCATE, REINDEX, and CLUSTER can assign the table a new filenode while its OID stays fixed.
- **C.** Because filenodes are recalculated from the table's OID using a hash function that changes each server restart.
- **D.** Because only temporary tables use filenode-based file names; permanent tables are named directly after their OID.

<details><summary>Answer</summary>

**B.** — A table's filenode is a separate identifier from its OID, and commands like TRUNCATE, REINDEX, and CLUSTER can assign a fresh filenode to the underlying file while the table keeps its original OID in the catalog.

</details>

### architecture-007

What happens once a table's main data file grows past the default 1 GB segment size?

- **A.** PostgreSQL automatically moves the table into a new tablespace to make room for further growth.
- **B.** The table is automatically split into child tables, each capped at 1 GB.
- **C.** PostgreSQL compresses the entire file in place so it stays under the 1 GB limit.
- **D.** PostgreSQL rolls over to a new segment file, appending .1, .2, and so on after the filenode.

<details><summary>Answer</summary>

**D.** — Table and index files are capped at roughly a gigabyte per segment mainly to sidestep old filesystem size limits; once that ceiling is crossed, PostgreSQL keeps writing into additional numbered segment files under the same filenode.

</details>

### architecture-008

Within an 8kB PostgreSQL page, why can an index safely store a reference (CTID) to a row's item identifier rather than to the row's raw byte offset?

- **A.** Because an item identifier keeps its slot until freed, even as the row data moves during compaction.
- **B.** Because CTIDs are automatically rewritten by a background process every time a row moves.
- **C.** Because row data is never moved once written; only entire pages are ever relocated.
- **D.** Because item identifiers are stored in a separate file from the page they describe, so they are unaffected by changes to that page.

<details><summary>Answer</summary>

**A.** — Because item identifiers occupy a fixed slot in the page's pointer array until freed, an index entry that references a slot number keeps working correctly even after the row's bytes get relocated during page compaction.

</details>

### architecture-009

What triggers PostgreSQL's TOAST mechanism to start compressing or relocating a row's oversized column values?

- **A.** Any single column value exceeding roughly 2kB by itself, regardless of the total row width.
- **B.** The table crossing 1GB in total size, which triggers TOAST for all of its variable-length columns at once.
- **C.** The row's total width crosses roughly 2kB, so TOAST-able columns get compressed and/or moved out-of-line.
- **D.** An explicit VACUUM FULL command, which is the only operation that invokes the TOAST code.

<details><summary>Answer</summary>

**C.** — TOAST only kicks in once a stored row's overall width crosses roughly a 2kB threshold, at which point PostgreSQL compresses and/or relocates TOAST-able column values, one at a time, until the row fits or nothing more can be shrunk.

</details>

### architecture-010

Which of the following statements about PostgreSQL's TOAST storage strategies are correct? *(choose two)*

- **A.** PLAIN prevents both compression and out-of-line storage, and is the only strategy possible for columns whose type isn't TOAST-able.
- **B.** MAIN is the default strategy for most TOAST-able data types and always compresses column values before storing them in the main table.
- **C.** EXTERNAL allows out-of-line storage but disables compression, which can make substring operations on wide text columns faster since a slice can be fetched without decompressing the whole value.
- **D.** EXTENDED disables out-of-line storage entirely and only ever compresses values in place.
- **E.** A table owner cannot change a column's storage strategy once the table has been created.

<details><summary>Answer</summary>

**A.** **C.** — PLAIN blocks any TOAST handling and is mandatory for non-TOAST-able types, while EXTERNAL skips compression specifically to make partial reads of wide values cheaper; EXTENDED (not MAIN) is the default and permits both compression and out-of-line storage, and the strategy can be changed later with ALTER TABLE.

</details>

### architecture-011

Which numeric type does the documentation recommend as the default choice for an ordinary integer column, and why?

- **A.** numeric, because whole numbers stored as numeric use less disk space than the same values stored as integer.
- **B.** smallint, because its smaller storage footprint always makes it faster than integer or bigint.
- **C.** bigint, because PostgreSQL silently promotes any integer arithmetic to 8 bytes internally regardless of the declared column type.
- **D.** integer, because it offers the best balance of range, storage size, and performance among the whole-number types.

<details><summary>Answer</summary>

**D.** — integer is presented as the general-purpose default because it balances storage cost, numeric range, and arithmetic speed better than smallint or bigint for typical columns; smallint only pays off when disk space is genuinely tight.

</details>

### architecture-012

How does PostgreSQL's numeric type handle the special value NaN when sorting or comparing it to other numeric values, and why?

- **A.** It treats NaN as equal to every other value, including ordinary numbers, so NaN can never be distinguished from 0.
- **B.** It treats NaN as equal to itself and greater than every non-NaN value, keeping numeric columns sortable.
- **C.** It refuses to store NaN in any numeric column, raising an error on insert.
- **D.** It treats NaN as less than every non-NaN value, placing it first in ascending sort order.

<details><summary>Answer</summary>

**B.** — Because ordinary floating-point NaN semantics would make NaN unusable in ordering, PostgreSQL instead defines NaN as equal to other NaNs and greater than every real number, so numeric columns remain fully sortable and indexable.

</details>

### architecture-013

A developer claims that declaring a column as char(20) instead of varchar(20) will make comparisons on that column faster, since char is a 'more native' fixed-width type. What does the documentation say about this claim?

- **A.** It's correct: char(n) avoids length-checking overhead entirely, making it measurably faster than varchar(n) for equality comparisons.
- **B.** It's correct, but only because char(n) values are stored with 4 bytes of overhead compared to 1 byte for varchar(n).
- **C.** It's incorrect: char(n) has no performance edge in PostgreSQL and is often the slowest of the three once padding is factored in.
- **D.** It's incorrect, but only because char(n) is deprecated and no longer usable in current PostgreSQL versions.

<details><summary>Answer</summary>

**C.** — Despite intuitions carried over from other database systems, PostgreSQL's char(n) gains nothing from its fixed width and instead tends to lag behind varchar/text once the cost of blank-padding is counted; it is not deprecated.

</details>

### architecture-014

For which of these string types does PostgreSQL treat trailing spaces as semantically insignificant when comparing two values of that same type?

- **A.** character(n) only
- **B.** All three of character(n), character varying(n), and text
- **C.** None of the three; trailing spaces are always significant in PostgreSQL string comparisons
- **D.** character varying(n) and text only

<details><summary>Answer</summary>

**A.** — PostgreSQL strips and ignores trailing blanks specifically when comparing character(n) values, but the same trailing blanks remain meaningful for character varying and text comparisons, which can produce mismatches if the types are mixed.

</details>

### architecture-015

A row is inserted with timestamptz '2024-03-01 09:00:00-05'. A session running in a different time zone later selects that column. What does PostgreSQL actually store and return?

- **A.** It converts the value to UTC internally, drops the original offset, and displays it in the querying session's active zone.
- **B.** It stores the original '-05' offset alongside the timestamp and always redisplays the value using that same offset, regardless of the querying session's time zone.
- **C.** It stores the value as entered with no time zone conversion at all, identical to how a plain timestamp column would store it.
- **D.** It rejects the insert, because timestamptz values must always be entered already converted to UTC by the client.

<details><summary>Answer</summary>

**A.** — timestamptz normalizes every incoming value to UTC using either an explicit offset or the session's active time zone, keeps only that UTC instant, and re-renders it in whichever zone a later session happens to be using.

</details>

### architecture-016

An application wants primary-key UUIDs that sort roughly in the order they were created, to help index locality, while still generating them without coordinating with any central counter. Which native PostgreSQL function fits this requirement, and why?

- **A.** gen_random_uuid(), because it produces sequential integers encoded as UUIDs.
- **B.** uuidv4(), because version 4 UUIDs are generated in strictly increasing order by design.
- **C.** uuidv7(), since it embeds a timestamp, making its values time-ordered unlike random UUIDs.
- **D.** Neither native function can produce time-ordered UUIDs; that requires a third-party extension.

<details><summary>Answer</summary>

**C.** — uuidv7() is documented as producing a time-ordered UUID because it computes its value from a Unix timestamp, so successive calls sort roughly by generation time, a property random UUIDv4 output (from gen_random_uuid() or uuidv4()) does not have.

</details>

### architecture-017

Which of the following statements about PostgreSQL's real, double precision, and numeric types are accurate? *(choose two)*

- **A.** numeric arithmetic is faster than integer arithmetic because numeric values are stored as fixed-width binary floats.
- **B.** Declaring a column as NUMERIC with no precision or scale forces every value to be rounded to zero decimal places.
- **C.** real and double precision are inexact IEEE-754 binary floating-point types, so common decimal fractions may not be stored as exact values.
- **D.** double precision guarantees exact storage of any decimal value with up to 15 digits after the decimal point.
- **E.** numeric is the documented alternative to floating-point types for values like currency where exact arithmetic matters.

<details><summary>Answer</summary>

**C.** **E.** — real and double precision approximate values using binary floating point, which is why numeric — with its exact, arbitrary-precision arithmetic (though far slower than integer math) — is recommended when rounding error can't be tolerated, such as for money.

</details>

### architecture-018

A table is created with a column declared as integer[3][3]. What does PostgreSQL actually enforce for values inserted into that column?

- **A.** Every inserted array must have exactly 3 rows and 3 columns, or the insert is rejected.
- **B.** Nothing beyond it being an integer array — the 3x3 size is purely documentation, not enforced.
- **C.** The array is automatically padded or truncated to fit a 3x3 shape on insert.
- **D.** Only one-dimensional arrays of exactly 3 elements are accepted; two-dimensional input raises an error.

<details><summary>Answer</summary>

**B.** — PostgreSQL records any array size or dimension count written in a column definition purely as documentation for readers; it is never checked against the arrays actually stored, so mismatched sizes are accepted without complaint.

</details>

### architecture-019

For the two-dimensional array column schedule, what does the subscript expression schedule[1:2][2] retrieve?

- **A.** It retrieves only the single element at row 1 through 2, column 2, since [2] always means 'exactly index 2' regardless of surrounding syntax.
- **B.** It raises a syntax error, because mixing a slice dimension with a non-slice dimension in the same subscript is not allowed.
- **C.** It is interpreted the same as schedule[1:2][2:2], returning a one-column slice starting and ending at column 2.
- **D.** It equals schedule[1:2][1:2], since any slice-notation dimension makes every dimension in the subscript a slice.

<details><summary>Answer</summary>

**D.** — Once any subscript in a multi-dimensional reference uses colon notation, every dimension is read as a slice, and a bare number in that context is shorthand for a slice running from 1 up to that number.

</details>

### architecture-020

Why do the literals '[4,8]' and '(3,9)' represent the same underlying value when cast to the built-in integer range type int4range?

- **A.** Because both literals are invalid and get silently coerced to the empty range.
- **B.** Because PostgreSQL ignores bound inclusivity entirely for all range types and always treats bounds as inclusive.
- **C.** Because int4range is discrete, PostgreSQL rewrites both into one canonical inclusive-exclusive form.
- **D.** Because int4range is a continuous range type, and continuous ranges never distinguish inclusive from exclusive bounds.

<details><summary>Answer</summary>

**C.** — int4range has a well-defined next/previous integer, so PostgreSQL rewrites any equivalent bound style into one canonical inclusive-lower, exclusive-upper form; a subtype without that notion, like numeric, keeps its bounds exactly as written instead.

</details>

### architecture-021

A client inserts the JSON text '{"a":1,"a":2}' into both a json column and a jsonb column. What does each column actually store?

- **A.** Both columns silently drop the entire object and store a JSON null, since duplicate keys are invalid JSON.
- **B.** Both columns raise an insert error, because PostgreSQL rejects any JSON object containing duplicate keys.
- **C.** The json column keeps only the last pair; the jsonb column preserves both, since jsonb is documented as the more literal, text-preserving format.
- **D.** The json column keeps both key/value pairs exactly as entered; the jsonb column keeps only the last one, discarding the first "a":1.

<details><summary>Answer</summary>

**D.** — The json type retains a literal copy of whatever text was supplied, so repeated keys all survive; jsonb reparses that text into a decomposed form at write time and keeps only the last value for any key that appears more than once.

</details>

### architecture-022

A table has a nullable column notes, and some rows have notes IS NULL. What does the query SELECT * FROM t WHERE notes = NULL; return?

- **A.** Zero rows, since notes = NULL evaluates to NULL, not true, even when notes is null.
- **B.** Every row in the table, because a NULL comparison is treated as a wildcard match.
- **C.** Every row where notes is null, because = NULL is PostgreSQL's shorthand for IS NULL.
- **D.** An error, because PostgreSQL disallows comparing any column directly to the NULL literal.

<details><summary>Answer</summary>

**A.** — Standard SQL comparison operators return unknown rather than true or false whenever either side is null, so a bare equality test against NULL can never match a row, even one where the compared column is itself null.

</details>

### architecture-023

Two nullable columns, a and b, both currently hold NULL for a given row. What does a IS NOT DISTINCT FROM b evaluate to for that row, and how does this differ from a = b?

- **A.** It evaluates to NULL, exactly like a = b would, since IS NOT DISTINCT FROM is just a more verbose spelling of the equality operator.
- **B.** It evaluates to true, treating the two nulls as matching each other; by contrast, a = b would evaluate to NULL (unknown), not true.
- **C.** It raises an error, since IS NOT DISTINCT FROM cannot be applied when both operands are null.
- **D.** It evaluates to false, because two null values are never considered equal under any PostgreSQL comparison operator.

<details><summary>Answer</summary>

**B.** — IS [NOT] DISTINCT FROM always resolves to a definite true or false, treating null as an ordinary comparable value; that's why two nulls count as matching under IS NOT DISTINCT FROM even though plain equality between them stays unknown.

</details>

### architecture-024

Which of the following statements are accurate? *(choose two)*

- **A.** json (not jsonb) is the preferred type for indexing because it retains exact input formatting.
- **B.** An EXCLUDE constraint backed by a GiST index can reject a new row whose range value overlaps a range already stored in the table, something a plain UNIQUE constraint cannot express.
- **C.** EXCLUDE constraints can only be defined using a B-tree index, never GiST.
- **D.** A plain UNIQUE constraint is the standard tool for preventing two reservations with overlapping time ranges from both being inserted.
- **E.** With the btree_gist extension installed, an exclusion constraint can combine an equality check on a scalar column with an overlap check on a range column, so overlapping ranges are only rejected when the scalar values also match.

<details><summary>Answer</summary>

**B.** **E.** — GiST-backed EXCLUDE constraints reject overlapping range values directly, something UNIQUE cannot express, and pairing them with the btree_gist extension lets an equality check on a plain column be combined with a range-overlap check in the same constraint.

</details>

## Schema Design & Constraints

22 questions

### schema-design-001

A table stores each order line together with the full customer address, repeated on every line. The customer moves, and only some rows get updated. What is this class of problem called?

- **A.** A deletion anomaly, because removing a row loses unrelated facts.
- **B.** An update anomaly, because one fact is stored in many places and the copies can disagree.
- **C.** An insertion anomaly, because a new row cannot be added without unrelated data.
- **D.** A referential integrity violation, because a foreign key no longer matches its parent.

<details><summary>Answer</summary>

**B.** — Storing one fact in multiple rows means every copy must be changed together. When an update reaches only some copies, the table now holds contradictory versions of the same fact — the update anomaly that normalization exists to prevent.

</details>

### schema-design-002

What does it mean to say that a functional dependency A -> B holds in a relation?

- **A.** Every value of B appears at least once for some value of A.
- **B.** A and B always change together whenever a row is updated.
- **C.** Each value of A is associated with exactly one value of B across the whole relation.
- **D.** A is a foreign key that references the column B in another table.

<details><summary>Answer</summary>

**C.** — A functional dependency A -> B says that fixing a value of A fixes the value of B: no two rows may share an A value while disagreeing on B. Identifying these dependencies is how redundancy is located, since a non-trivial dependency whose determinant is not a superkey signals a fact stored in the wrong place.

</details>

### schema-design-003

A single table combines Employees and Departments: each row has employee_id, employee_name, department_id, department_name, and department_budget. A brand-new department has just been created but has no employees assigned to it yet, and separately, the last employee in another department has just resigned and been deleted. What do these two situations illustrate?

- **A.** Both are examples of an update anomaly, because department_budget is duplicated across every employee row in the same department.
- **B.** The new department can't be recorded without an insertion anomaly forcing a fabricated employee row, and the resigning employee's deletion causes a deletion anomaly that erases the department's name and budget entirely.
- **C.** Both are referential integrity violations, because department_id no longer has a matching row to reference.
- **D.** The new department is blocked by a deletion anomaly, and the resigning employee triggers an insertion anomaly.

<details><summary>Answer</summary>

**B.** — Because department facts live only on rows that also hold an employee, a department with no employees yet can't be inserted without either violating the table's employee-related columns or fabricating a placeholder employee — an insertion anomaly. When the last employee tied to a department is deleted, the department's name and budget disappear along with that row, since nothing else in the table holds those facts — a deletion anomaly. Neither case is a referential integrity violation, since there's only one table here and no foreign key is left dangling; and duplicated department_budget across many employees in the same department is the separate problem of an update anomaly, not what's illustrated by these two events.

</details>

### schema-design-004

Which of the following are true properties of a relation in the relational model as it is standardly formulated? *(choose four)*

- **A.** The rows of a relation have no defined order; two relations containing the same rows are the same relation regardless of row order.
- **B.** The attributes (columns) of a relation have no defined order; a column is identified by name rather than by position.
- **C.** A relation may not contain two identical rows, since a relation is defined as a set of tuples.
- **D.** Every cell in a relation holds a single, atomic value drawn from the attribute's domain, rather than a list or a nested structure.
- **E.** A relation must always include a column explicitly designated as an auto-incrementing surrogate key.
- **F.** A relation must have at least one foreign key referencing another relation.
- **G.** Every relation must contain a timestamp column recording when each row was last modified.

<details><summary>Answer</summary>

**A.** **B.** **C.** **D.** — In the standard formulation a relation is a set of tuples, and a tuple is a set of attribute-name/value pairs. Because the rows form a set, they have no inherent order and no element can appear twice, so duplicate rows are excluded by definition; because a tuple's components are addressed by attribute name rather than by position, the columns have no defined order either; and each attribute draws its values from a domain of atomic values, so a cell can't hold a list or a nested record. (This list describes the relational model as it is standardly taught today, not Codd's original 1970 paper specifically, which framed some of these points differently.) None of the three false statements are part of the relational model itself — a surrogate auto-increment key, a mandatory foreign key, and a mandatory audit timestamp are schema-design choices some tables make, not properties every relation must have.

</details>

### schema-design-005

A table storing employees has a NOT-NULL unique employee_id column and a NOT-NULL unique national_id_number column; either one, on its own, could uniquely identify every row. The schema designer chooses employee_id as the table's official row identifier. What is the correct relational-theory term for national_id_number after that choice is made?

- **A.** It stops being a key entirely, since a table can only have one key once a primary key is chosen.
- **B.** It remains a candidate key: a column, or column set, that qualifies to identify rows uniquely, even though it was not the one selected as the primary key.
- **C.** It becomes a foreign key, since only the primary key is now allowed to identify a row.
- **D.** It becomes a superkey, a category that only applies to columns not chosen as primary.

<details><summary>Answer</summary>

**B.** — A candidate key is any minimal column set that could uniquely identify every row, and a table can have more than one. Choosing one as the primary key doesn't strip the others of that status — they remain candidate keys, simply not the one selected for that role (often still enforced elsewhere with its own UNIQUE constraint). national_id_number doesn't become a foreign key, since it doesn't reference another table's key; and 'superkey' isn't specific to the unchosen candidates — a candidate key is itself already a minimal superkey, chosen as primary or not.

</details>

### schema-design-006

A table defines product_no integer UNIQUE, with no other constraint on that column. What does PostgreSQL allow, and how would replacing UNIQUE with PRIMARY KEY change that?

- **A.** UNIQUE alone permits any number of rows with product_no left NULL, because nulls are not considered equal to each other by default; PRIMARY KEY would reject any NULL, since a primary key requires values to be both unique and not null.
- **B.** UNIQUE alone permits at most one row with product_no left NULL, since a unique column becomes implicitly NOT NULL after the first null is stored; PRIMARY KEY behaves identically.
- **C.** UNIQUE alone rejects NULL outright, exactly as PRIMARY KEY does, so switching between them changes nothing about null handling.
- **D.** UNIQUE alone permits unlimited NULLs only if NULLS NOT DISTINCT is added to the column; without it, no row may store NULL in product_no.

<details><summary>Answer</summary>

**A.** — By default, PostgreSQL treats two null values as not equal to one another for a unique constraint's purposes, so a UNIQUE column can hold NULL in any number of rows without violating the constraint (this default can be changed with NULLS NOT DISTINCT, which then limits the column to at most one NULL). PRIMARY KEY does not inherit that default: the documentation states a primary key requires values to be both unique and not null, which is why `product_no integer UNIQUE NOT NULL` and `product_no integer PRIMARY KEY` are presented as equivalent table definitions. UNIQUE alone never behaves as though nulls were implicitly disallowed after the first one is stored, and NULLS NOT DISTINCT is what removes multi-null tolerance, not what grants it.

</details>

### schema-design-007

A table defines id integer GENERATED ALWAYS AS IDENTITY. An application runs INSERT INTO t (id, name) VALUES (500, 'widget') with no other clauses. What happens, and how would defining the column as GENERATED BY DEFAULT AS IDENTITY instead change the outcome?

- **A.** The INSERT is rejected, because ALWAYS accepts a user-supplied value only when the statement includes OVERRIDING SYSTEM VALUE; with BY DEFAULT, the same INSERT would succeed and store 500 as given.
- **B.** The INSERT succeeds and silently discards the value 500 in favor of the next sequence value; BY DEFAULT would instead raise an error for supplying an explicit value.
- **C.** The INSERT is rejected under both ALWAYS and BY DEFAULT, since identity columns can never accept an explicit value under any syntax.
- **D.** The INSERT succeeds and stores 500 under ALWAYS with no special clause required; BY DEFAULT would instead require OVERRIDING SYSTEM VALUE to accept the same value.

<details><summary>Answer</summary>

**A.** — For a column generated ALWAYS AS IDENTITY, the documentation is explicit that a user-specified value is only accepted if the INSERT statement specifies OVERRIDING SYSTEM VALUE — without it, this INSERT is rejected. Defining the column BY DEFAULT AS IDENTITY reverses that default: the user-specified value takes precedence over the generated one, so the identical statement would succeed and store 500 with no extra clause needed. PostgreSQL never silently discards an explicit value in favor of a generated one, and OVERRIDING SYSTEM VALUE is what ALWAYS requires to accept an override — BY DEFAULT doesn't need it at all.

</details>

### schema-design-008

A table defines discount_pct numeric CHECK (discount_pct BETWEEN 0 AND 100), with no NOT NULL constraint on the column. An application runs INSERT INTO promotions (discount_pct) VALUES (NULL). What happens?

- **A.** The INSERT fails: NULL cannot make discount_pct BETWEEN 0 AND 100 evaluate to true, and a CHECK constraint only lets a row through when its expression is true.
- **B.** The INSERT succeeds: a CHECK constraint is satisfied whenever its expression evaluates to true or to null, and comparing NULL against the range yields null rather than false, so nothing is violated.
- **C.** The INSERT fails: PostgreSQL treats any column named in a CHECK expression as implicitly NOT NULL, whether or not NOT NULL is written explicitly.
- **D.** The INSERT fails unless the constraint is rewritten as CHECK (discount_pct IS NULL OR discount_pct BETWEEN 0 AND 100) — only that explicit OR lets a null value through.

<details><summary>Answer</summary>

**B.** — The documentation is explicit that a check constraint is satisfied if the expression evaluates to true or to null, and since most expressions evaluate to null when an operand is null, a CHECK will not by itself prevent nulls in the columns it constrains. BETWEEN 0 AND 100 applied to a null operand yields null, not false, so the row passes and the INSERT succeeds. The first option describes how a CHECK would behave if only 'true' passed it, which is not how PostgreSQL evaluates the constraint. The third invents a NOT NULL side effect that CHECK does not have — nullability is a separate, dedicated constraint. The fourth is a common defensive habit that turns out to be unnecessary: the null-passes rule already applies without spelling out an explicit IS NULL branch.

</details>

### schema-design-009

Which of the following are true about what a foreign key constraint requires and permits in PostgreSQL? *(choose three)*

- **A.** The referenced columns must be the target table's primary key, be covered by a unique constraint, or be columns of a non-partial unique index — an arbitrary unconstrained column cannot be referenced.
- **B.** By default, a referencing row satisfies the constraint automatically if any of its foreign-key columns is null, even though that value matches no row in the referenced table.
- **C.** A foreign key may reference a column of the very table it's declared on, creating a self-referential foreign key such as an employee row pointing at its own manager's row.
- **D.** A foreign key can reference any column of the target table, unique or not, as long as the referencing and referenced columns' data types agree.
- **E.** Declaring a foreign key constraint automatically creates an index on the referencing column(s), the same way a primary key automatically creates a unique index.
- **F.** The referencing column and the referenced column must be given identical names on both sides of the relationship.
- **G.** A referencing row with a null in any of its foreign-key columns is always rejected, since a null value can never be treated as a valid match.

<details><summary>Answer</summary>

**A.** **B.** **C.** — Three of these are documented directly: a foreign key must reference a primary key, a unique constraint, or a non-partial unique index, because the reference only works if the target side is guaranteed unique; a referencing row is normally exempt from the check if any referencing column is null, on the same logic that makes null incomparable to anything; and self-referential foreign keys, where the other table of the relationship is the same table, are explicitly supported. The rest are false. Any column can share a data type with another, but only a unique-backed column can be referenced — the documentation is explicit that declaring a foreign key constraint does not automatically create an index on the referencing columns, since indexing needs vary and PostgreSQL leaves that choice to the schema author; column names on the two sides need not match at all, only the number and type of the columns need to correspond; and a null referencing value is exempt from the check by default, the opposite of always being rejected.

</details>

### schema-design-010

orders.customer_id references customers(customer_id) ON DELETE CASCADE. A customer who has placed several orders is deleted with DELETE FROM customers WHERE customer_id = 42. What happens to that customer's rows in orders?

- **A.** Every order row referencing customer_id 42 is deleted along with the customer row.
- **B.** Every order row referencing customer_id 42 has its customer_id column set to null, but the order rows themselves remain.
- **C.** The DELETE on customers is rejected outright, because rows in orders still reference customer_id 42.
- **D.** Every order row referencing customer_id 42 has its customer_id column reset to whatever DEFAULT value the column was declared with.

<details><summary>Answer</summary>

**A.** — CASCADE is documented to mean that when a referenced row is deleted, the row(s) referencing it are automatically deleted as well — so every matching order row is removed along with the customer. The second option describes SET NULL, which clears the referencing column instead of deleting the row; the third describes RESTRICT or NO ACTION, which reject the deleting statement rather than propagate it; and the fourth describes SET DEFAULT, which resets the referencing column to its default rather than removing the row. Each is a real referential action, just not the one CASCADE performs.

</details>

### schema-design-011

order_items.assigned_rep_id references sales_reps(rep_id) ON DELETE SET NULL. A sales rep who has been assigned to existing order_items rows resigns and is deleted with DELETE FROM sales_reps WHERE rep_id = 7. What happens to the order_items rows that had assigned_rep_id = 7?

- **A.** Those order_items rows are deleted along with the sales_reps row.
- **B.** Those order_items rows remain, but their assigned_rep_id column is set to null.
- **C.** The DELETE on sales_reps is rejected, since rows in order_items still reference rep_id 7.
- **D.** Those order_items rows remain, but their assigned_rep_id column is reset to whatever DEFAULT value the column was declared with.

<details><summary>Answer</summary>

**B.** — SET NULL is documented to cause the referencing column(s) in the referencing rows to be set to null when the referenced row is deleted — the row survives, only the reference is cleared. The first option describes CASCADE, which removes the referencing row instead of clearing a column; the third describes RESTRICT or NO ACTION, which block the delete instead of letting it through; and the fourth describes SET DEFAULT, a distinct action that resets the column to its default value rather than to null. Mixing these up is exactly why picking the wrong referential action on a foreign key can either silently orphan-clear data or delete far more than intended.

</details>

### schema-design-012

A foreign key is declared FOREIGN KEY (customer_id) REFERENCES customers (customer_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED. Within a transaction, a statement deletes a customer row that still has referencing order rows, and a later statement in the same transaction would delete those order rows too before commit. What happens?

- **A.** The DELETE on customers is rejected immediately: RESTRICT does not allow its check to be deferred until later in the transaction, so DEFERRABLE INITIALLY DEFERRED has no effect on how a RESTRICT action is checked.
- **B.** The DELETE on customers succeeds, and the check is postponed to commit time exactly as DEFERRABLE INITIALLY DEFERRED specifies, giving the later statement in the same transaction a chance to remove the dangling order rows before the constraint is ever checked.
- **C.** The DELETE on customers is rejected, but only because RESTRICT and NO ACTION are the same action under different names, and neither one can ever be deferred no matter what the constraint declares.
- **D.** The DELETE on customers succeeds with no check performed at all, because RESTRICT only governs UPDATE statements on the referenced table and has no effect on DELETE.

<details><summary>Answer</summary>

**A.** — The documentation draws this exact line: RESTRICT does not allow the check to be deferred until later in the transaction, so it fires the instant the triggering statement runs regardless of any DEFERRABLE clause written on the constraint. NO ACTION is the setting that behaves differently — when the constraint is deferrable, checking of foreign-key constraints can be deferred to later in the transaction, letting other commands 'fix' the situation first, such as deleting the now-dangling referencing rows. The second option describes that NO ACTION behavior, not what RESTRICT does. The third is wrong because NO ACTION and RESTRICT are not interchangeable — that is precisely the distinction this scenario tests, and NO ACTION can be deferred. The fourth is wrong because RESTRICT governs both ON DELETE and ON UPDATE, not just updates.

</details>

### schema-design-013

Two existing rows in a table have unique code values 'A100' and 'B200', and a single transaction needs to swap them — the row currently holding 'A100' should end up with 'B200', and vice versa — using two UPDATE statements. The UNIQUE constraint on code is declared DEFERRABLE INITIALLY DEFERRED. Why does this let the swap succeed, when the same two UPDATE statements would fail against a plain, non-deferrable UNIQUE constraint?

- **A.** Because the uniqueness check is postponed until the transaction commits, the momentary state after only the first UPDATE — where the row now holds a duplicate of the other row's original code — is never actually checked; only the final state at commit has to satisfy the constraint.
- **B.** Because DEFERRABLE INITIALLY DEFERRED disables the UNIQUE constraint for the rest of the session, so the swap succeeds without any uniqueness check happening at all, deferred or otherwise.
- **C.** Because a deferred constraint is checked after each statement rather than at commit, so by the time the second UPDATE runs, the first row's new value has already replaced the old one and there is nothing left to collide with.
- **D.** Because PostgreSQL automatically rewrites a same-transaction swap of two unique values into a single atomic statement whenever the constraint is deferrable, avoiding the collision without postponing the check.

<details><summary>Answer</summary>

**A.** — INITIALLY DEFERRED means the constraint is checked only at the end of the transaction rather than after each statement, so the intermediate moment between the two UPDATEs — where one row briefly duplicates a code the other row is about to give up — is simply never examined; only the state at commit, where both codes are unique again, has to pass. A non-deferrable constraint, by contrast, is checked immediately after every command and would reject the first UPDATE outright. The second option is wrong because deferring a constraint postpones its check, it does not disable the check — it still runs at commit and can still fail there. The third describes INITIALLY IMMEDIATE, the opposite default. The fourth invents a rewriting mechanism PostgreSQL does not perform; nothing about the two statements themselves changes, only when the constraint is evaluated.

</details>

### schema-design-014

order_shipping has a composite foreign key (carrier_id, service_code) REFERENCES carrier_services (carrier_id, service_code) MATCH FULL. An INSERT supplies carrier_id = NULL and service_code = 'GROUND' — one column null, the other a real value. What happens?

- **A.** The INSERT is rejected: MATCH FULL exempts a row from the constraint only when all of its referencing columns are null, and a mix of null and non-null values is guaranteed to fail the check.
- **B.** The INSERT succeeds: MATCH FULL exempts a row from the constraint as soon as any single referencing column is null, the same as the default matching behavior.
- **C.** The INSERT is rejected, but only because MATCH FULL forbids null values in a composite foreign key under any circumstance, even a row where every referencing column is null.
- **D.** The INSERT succeeds: MATCH FULL only evaluates the first-listed column of the composite key, so a null carrier_id alone exempts the row regardless of what service_code holds.

<details><summary>Answer</summary>

**A.** — The documentation states this precisely: with MATCH FULL added to a foreign key declaration, a referencing row escapes satisfying the constraint only if all of its referencing columns are null, and a mix of null and non-null values is guaranteed to fail the constraint. Here carrier_id is null but service_code is not, so the row fails MATCH FULL and the INSERT is rejected. The second option describes the default MATCH SIMPLE behavior, which MATCH FULL was specifically added to change — under MATCH FULL that any-null exemption no longer applies. The third overstates MATCH FULL: an all-null row is still exempt under MATCH FULL, it is only a partial mix of null and non-null that is rejected. The fourth invents column-order significance that MATCH FULL does not have; it evaluates every referencing column together, not just the first one listed.

</details>

### schema-design-015

A large, already-populated orders table runs ALTER TABLE orders ADD CONSTRAINT fk_customer FOREIGN KEY (customer_id) REFERENCES customers (customer_id) NOT VALID;, and only later runs ALTER TABLE orders VALIDATE CONSTRAINT fk_customer;. What does each of these two statements actually do?

- **A.** ADD CONSTRAINT ... NOT VALID skips scanning the table's existing rows and applies the constraint only to future inserts and updates; VALIDATE CONSTRAINT later scans the pre-existing rows, and because concurrent writes are already being checked, it needs only a SHARE UPDATE EXCLUSIVE lock rather than the heavier lock a normal scanning ADD CONSTRAINT would require.
- **B.** ADD CONSTRAINT ... NOT VALID skips enforcement entirely until VALIDATE CONSTRAINT runs, at which point both the pre-existing rows and all future writes start being checked for the first time.
- **C.** ADD CONSTRAINT ... NOT VALID performs the full row-by-row scan of existing rows immediately, and VALIDATE CONSTRAINT afterward is only a no-op marker recording that the scan already happened.
- **D.** ADD CONSTRAINT ... NOT VALID applies to future rows only and never needs VALIDATE CONSTRAINT run at all — the constraint is already considered fully valid the moment it is declared.

<details><summary>Answer</summary>

**A.** — The documentation is explicit on both halves. NOT VALID skips the potentially lengthy scan that a normal ADD CONSTRAINT would perform, but the constraint still applies against subsequent inserts or updates from the moment it is added — it does not wait for validation to start enforcing new writes. What NOT VALID leaves open is only the claim about rows already in the table: the database will not assume the constraint holds for pre-existing rows until VALIDATE CONSTRAINT is run, and that later scan acquires only a SHARE UPDATE EXCLUSIVE lock rather than the stronger lock a scanning ADD CONSTRAINT needs, since new writes are already being checked and only the old rows remain to verify. The second option is wrong because enforcement of new writes starts immediately, not after validation; the third has the two statements backwards; and the fourth ignores that the documentation explicitly withholds full validity from a NOT VALID constraint until VALIDATE CONSTRAINT succeeds.

</details>

### schema-design-016

A table students(student_id, student_name, phone_numbers) stores a student with two phone numbers as a single row where phone_numbers holds the text '555-1234, 555-5678'. student_id is the table's only key. Which normal form does this table violate, and why?

- **A.** First normal form, because phone_numbers packs more than one value into a single cell instead of holding one atomic value — the repeating group of phone numbers should be modeled as its own row or table, not a delimited list crammed into one field.
- **B.** Second normal form, because phone_numbers depends only on part of a composite primary key rather than the whole key.
- **C.** Third normal form, because phone_numbers is transitively dependent on a non-key attribute rather than directly on student_id.
- **D.** This table is already fully normalized — a comma-separated list is a standard, compliant way to store a one-to-many relationship inside a single relational column.

<details><summary>Answer</summary>

**A.** — First normal form requires every cell to hold a single value with no repeating groups or embedded lists, and a comma-separated list of phone numbers is exactly that kind of repeating group stuffed into one field — the fix is to give each student-phone pairing its own row. The second option cannot apply here: a partial dependency requires a composite key to be partial against, and this table has a single-column key, student_id, with nothing to be 'part of.' The third invents a transitive chain that isn't present — phone_numbers depends directly on student_id, not through some other non-key attribute. The fourth mistakes the presence of data for correctness; a delimited multi-value field is precisely the repeating-group problem 1NF exists to rule out, not an accepted way to store one.

</details>

### schema-design-017

A table enrollments(student_id, course_id, student_email, course_title, grade) has a composite primary key (student_id, course_id). student_email depends only on student_id, and course_title depends only on course_id — neither depends on the full key. Which normal form does this violate, and why?

- **A.** Second normal form, because student_email and course_title are each partial dependencies — attributes depending on only part of the composite key rather than on the whole key.
- **B.** First normal form, because student_id and course_id have been combined into a composite primary key instead of a single generated key.
- **C.** Third normal form, because student_email and course_title are each transitively dependent on grade, a non-key attribute, rather than on the primary key directly.
- **D.** The table is already fully normalized, since every non-key column is filled in for every row and none of them are duplicated within the same row.

<details><summary>Answer</summary>

**A.** — Second normal form forbids exactly this: a non-key attribute depending on only part of a composite key rather than on the whole key. student_email depending on student_id alone, and course_title depending on course_id alone, are both textbook partial dependencies, fixed by splitting the table so each attribute lands in the table whose key it actually depends on. The second option is wrong because using a composite key is a legitimate, 1NF-compliant design choice, not a violation in itself. The third misreads the dependency — grade determines nothing here, and neither student_email nor course_title depends on it; a transitive chain running through a non-key attribute isn't what's happening. The fourth confuses 'every cell is filled in with no per-row duplication' with normalization, but a table can be complete and duplicate-free within each row and still repeat facts across rows, which is exactly what a partial dependency causes.

</details>

### schema-design-018

A table orders(order_id, order_date, customer_id, customer_email) has order_id as its only key. customer_id determines customer_email (customer_id -> customer_email), and customer_email is not part of any key. Which normal form does this violate, and why?

- **A.** Third normal form, because customer_email depends on order_id only transitively, through customer_id, rather than directly — a non-key attribute is determining another non-key attribute.
- **B.** Second normal form, because customer_email depends on only part of the primary key rather than on the whole key.
- **C.** First normal form, because customer_email is a repeated value that appears on more than one order row belonging to the same customer.
- **D.** The table is already fully normalized, because order_id determines every other column in the table, whether directly or through another column.

<details><summary>Answer</summary>

**A.** — Third normal form forbids a chain where a key determines a non-key attribute which in turn determines another non-key attribute: here order_id -> customer_id -> customer_email means customer_email depends on the key only transitively, through customer_id, rather than directly. That's the transitive-dependency problem 3NF rules out, fixed by moving customer_email (and the rest of the customer's facts) into their own table keyed on customer_id. The second option can't apply, since order_id is a single-column key — there's no composite key for anything to be a 'part' of. The third misapplies 1NF, which is about a single cell holding more than one value, not about the same fact appearing across multiple rows. The fourth is the exact misconception 3NF corrects: determining a value indirectly, through another non-key column, is not the same as determining it directly from the key, and that gap is what causes an update to one row's customer_email to leave other rows for the same customer contradicting it.

</details>

### schema-design-019

A table order_items(order_id, product_id, discount_code, quantity) has two candidate keys — (order_id, product_id) and (order_id, discount_code) — because a discount code is always tied to exactly one product, so discount_code -> product_id holds. Because product_id is part of a candidate key, this dependency does not violate third normal form. Why does the table still fail Boyce-Codd normal form?

- **A.** Because discount_code -> product_id is a nontrivial dependency whose determinant, discount_code alone, is not itself a candidate key — BCNF requires every determinant to be a candidate key outright, with no exception for cases where the dependent attribute happens to be part of another key.
- **B.** Because BCNF, unlike third normal form, forbids a table from having more than one candidate key at all, and this table has two.
- **C.** Because product_id is not fully dependent on both candidate keys at once, which is the partial-dependency problem BCNF specifically targets.
- **D.** Because discount_code is nullable, and BCNF requires every column that participates in any candidate key to be declared NOT NULL.

<details><summary>Answer</summary>

**A.** — Third normal form carves out an exception for a dependency whose determinant isn't a candidate key, as long as the attribute it determines is part of some candidate key — here product_id is part of (order_id, product_id), so 3NF lets discount_code -> product_id slide. BCNF removes that exception entirely: every determinant of a nontrivial dependency must itself be a candidate key, full stop, and discount_code alone is not one, so the dependency violates BCNF even though it satisfies 3NF. The second option is false — BCNF has nothing against a table having multiple candidate keys, and in fact this exact scenario (two overlapping candidate keys) is the classic setup where the 3NF/BCNF gap shows up. The third misidentifies which normal form targets partial dependencies — that's second normal form's concern, not BCNF's. The fourth invents a NOT NULL requirement that has nothing to do with BCNF, which is defined purely in terms of functional dependencies and candidate keys.

</details>

### schema-design-020

orders and products have a many-to-many relationship, resolved with a junction table order_items(order_id, product_id, quantity, discount_code) whose primary key is (order_id, product_id). Which of the following statements about this design are true? *(choose three)*

- **A.** The junction table's primary key is typically the composite of the two foreign keys it holds, which ensures each order-product pairing can appear at most once.
- **B.** Attributes that describe the relationship itself, such as quantity or a discount code applied to that specific pairing, belong on the junction table rather than on either of the two related tables.
- **C.** A single foreign key column cannot express a many-to-many relationship in either direction, which is why a third table is needed to resolve it.
- **D.** A many-to-many relationship can always be modeled with a single foreign key placed on whichever of the two related tables happens to have fewer rows.
- **E.** The junction table must be given a surrogate primary key of its own, since a composite primary key made of two foreign key columns is not permitted in PostgreSQL.
- **F.** Once the junction table's composite primary key exists, foreign key constraints referencing orders and products are unnecessary, since the primary key alone already guarantees referential integrity to both parent tables.
- **G.** A many-to-many relationship should instead be modeled by adding a nullable column to each of the two related tables that stores the other table's key.

<details><summary>Answer</summary>

**A.** **B.** **C.** — Three of these hold: a junction table's primary key is ordinarily the pair of foreign keys it carries, which is what stops the same pairing from being recorded twice; attributes that exist only in the context of the relationship — how many of a product on an order, what discount code applied to that line — belong on the junction table, not forced onto orders or products where they don't describe a single order or a single product; and a lone foreign key column, wherever it's placed, can only express a relationship in one direction at a time, which is exactly why neither orders nor products alone can hold a many-to-many link. The rest are false. A single foreign key on the smaller-row-count table is how a one-to-many relationship is modeled, not many-to-many — row count has nothing to do with which relationship kind applies. PostgreSQL permits a composite primary key made of foreign key columns without issue; that's precisely what a junction table's key is. And a composite primary key only guarantees that a given pairing is unique — it says nothing about whether the order_id and product_id values it contains actually exist in orders and products, which is exactly what separate foreign key constraints are still needed to enforce; adding nullable cross-reference columns to each of the two tables instead is not a working substitute and doesn't even allow a product to appear on more than one order.

</details>

### schema-design-021

order_items.line_total is declared GENERATED ALWAYS AS (quantity * unit_price) STORED. An application runs INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total) VALUES (1, 5, 3, 9.99, 29.97). What happens?

- **A.** The INSERT is rejected: a generated column cannot be given an explicit value in an INSERT statement — only the keyword DEFAULT is accepted in that position — and PostgreSQL computes line_total itself from quantity and unit_price.
- **B.** The INSERT succeeds and stores 29.97 exactly as supplied, and PostgreSQL only recomputes line_total later if the row is subsequently updated.
- **C.** The INSERT succeeds, but PostgreSQL silently discards the supplied 29.97 and substitutes its own computed value without raising any error.
- **D.** The INSERT is rejected only because quantity * unit_price does not evaluate to exactly 29.97 in this case; had the arithmetic matched, the explicit value would have been accepted and stored as given.

<details><summary>Answer</summary>

**A.** — The documentation states plainly that a generated column cannot be written to directly: in an INSERT or UPDATE command, no value can be specified for it, and only the keyword DEFAULT is accepted in its place. Supplying 29.97 explicitly for line_total is exactly the kind of direct write the column rejects, so the statement fails rather than being adjusted or accepted. The second and third options both assume the INSERT succeeds, which it does not — a generated column never accepts a caller-supplied value at all, whether stored silently or applied only on some later update. The fourth treats line_total as though it were CHECK-validated against the caller's arithmetic rather than fully computed by the database — but a generated column's value is never taken from the statement in the first place, so no amount of arithmetic matching would make an explicit value acceptable.

</details>

### schema-design-022

Several tables each need a postal_code column restricted to the same 5-or-9-digit pattern. Instead of repeating CHECK (postal_code ~ '^\d{5}(-\d{4})?$') on every table, a designer runs CREATE DOMAIN us_postal_code AS text CHECK (VALUE ~ '^\d{5}(-\d{4})?$') and declares each column as postal_code us_postal_code. What does the domain provide that declaring postal_code text with the same CHECK repeated on each table would not?

- **A.** A single named type that bundles the base type together with its constraint, so the validation rule is defined once and reused wherever the domain is used as a column type, rather than being copied into every table's definition by hand.
- **B.** Faster query performance, since PostgreSQL automatically indexes any column typed as a domain, even when the same column typed as plain text would not be indexed.
- **C.** The ability to store a value that violates the CHECK expression as long as it is corrected before the transaction commits, unlike a CHECK constraint declared directly on a column.
- **D.** Automatic retroactive enforcement of the constraint on every existing text column in the database, even columns that were never declared using the us_postal_code domain.

<details><summary>Answer</summary>

**A.** — The documentation describes a domain as essentially a data type with optional constraints, and states its purpose directly: when several tables need the same constraint on a column, defining a domain once and using it as the column type avoids setting up each table's constraint individually. That is the entire benefit here — one named definition, reused everywhere, instead of the same CHECK expression copy-pasted into every CREATE TABLE. The domain grants no special indexing behavior; nothing about declaring a column as a domain type changes whether it gets indexed. It grants no deferred-validation behavior either — a domain's CHECK is enforced the same way a column CHECK is, with no allowance for a transaction to leave it violated temporarily. And a domain only affects columns actually declared with that domain as their type; it has no retroactive effect on unrelated text columns that never used it.

</details>

## Querying & SQL

24 questions

### querying-001

In the query SELECT * FROM orders LEFT JOIN shipments ON orders.order_id = shipments.order_id;, what happens to a row of orders that has no matching row in shipments?

- **A.** It causes the entire query to raise an error at execution time, since LEFT JOIN is documented as requiring every single left-side row to find at least one match on the right.
- **B.** It appears once for every row of shipments, with shipments' columns repeated unchanged each time.
- **C.** It still appears in the output exactly once, with null values standing in for every column that would have come from shipments.
- **D.** It is silently dropped from the output, exactly as it would be under an INNER JOIN.

<details><summary>Answer</summary>

**C.** — A LEFT OUTER JOIN starts from the inner-join result and then adds back one row for every left-side row that found no partner, filling the right-hand columns with null rather than dropping the row or duplicating it.

</details>

### querying-002

A query joins orders LEFT JOIN shipments ON orders.order_id = shipments.order_id and also needs to restrict output to rows where shipments.carrier = 'FastFreight'. Compared to adding that condition into the ON clause, what changes if it is instead written as a separate WHERE shipments.carrier = 'FastFreight'?

- **A.** Nothing changes: ON and WHERE conditions are always fully interchangeable, for outer joins just as much as inner joins.
- **B.** PostgreSQL automatically rewrites the LEFT JOIN into a FULL JOIN so that no rows on either side get lost.
- **C.** Moving that same condition into the ON clause instead is rejected by the parser as invalid syntax, since an ON condition may reference only the columns being compared by the join.
- **D.** The WHERE version runs after the join completes, so it filters out the null-padded rows for unmatched orders rows, since a comparison against null is never true — effectively turning the LEFT JOIN into an inner join.

<details><summary>Answer</summary>

**D.** — A condition placed in ON is applied while the join itself is being computed, before unmatched rows get padded with nulls, so those rows survive; that same condition placed in WHERE instead runs against the already-completed join result, and because it can never be true against a null, it strips out the very padded rows the LEFT JOIN existed to preserve.

</details>

### querying-003

The subquery SELECT manager_id FROM employees can return NULL for employees with no manager. If at least one row has a null manager_id, what does SELECT name FROM employees WHERE employee_id NOT IN (SELECT manager_id FROM employees) return?

- **A.** The NULL in the subquery's result set is simply skipped over, so NOT IN behaves as if it had been written as a NOT EXISTS correlated subquery.
- **B.** Zero rows, because the presence of a null among the subquery's results makes the NOT IN comparison evaluate to null (unknown) for every outer row, and a WHERE clause treats unknown the same as false.
- **C.** PostgreSQL raises an error at query time, since NOT IN cannot legally be evaluated against a subquery whose result set contains a null value.
- **D.** Every employee who does not personally manage anyone, exactly matching what a reader would naturally expect this query to return.

<details><summary>Answer</summary>

**B.** — Because NOT IN is effectively an AND of not-equal comparisons across every subquery row, one null result poisons the whole expression to null/unknown for every outer row, and a WHERE clause discards unknown results just like false ones — so the query silently returns nothing.

</details>

### querying-004

Why is NOT EXISTS (SELECT 1 FROM employees WHERE manager_id = employees.employee_id) considered a safer way than the NOT IN version to find employees with no direct reports, given that manager_id can hold nulls?

- **A.** A correlated EXISTS/NOT EXISTS test only cares whether the subquery returns at least one row at all, so it never has to directly compare against a value that might be null.
- **B.** NOT EXISTS automatically strips null rows out of its subquery's result set before evaluating anything, which NOT IN does not do.
- **C.** The query planner silently rewrites every NOT EXISTS predicate into an equivalent LEFT JOIN combined with an IS NULL check internally, and that rewrite is what makes the nulls stop mattering here.
- **D.** NOT EXISTS is guaranteed to scan its subquery all the way to completion on every call, unlike NOT IN, which can stop early.

<details><summary>Answer</summary>

**A.** — EXISTS-family predicates depend only on row presence, not on the contents of any row, so there is no comparison-against-a-value step for a null to poison — which is exactly the mechanism that makes NOT IN unsafe when the subquery's column can be null.

</details>

### querying-005

Which of the following statements about the ANY, SOME, and ALL subquery quantifiers are accurate? *(choose three)*

- **A.** expression IN (subquery) is defined to behave identically to expression = ANY (subquery).
- **B.** expression NOT IN (subquery) is defined to behave identically to expression <> ALL (subquery).
- **C.** SOME is accepted as an exact, interchangeable synonym for ANY when quantifying a subquery comparison.
- **D.** expression operator ALL (subquery) always evaluates to false whenever the subquery returns zero rows.
- **E.** expression operator ANY (subquery) always evaluates to true whenever the subquery returns zero rows.

<details><summary>Answer</summary>

**A.** **B.** **C.** — IN is documented as equivalent to = ANY and NOT IN as equivalent to <> ALL, and SOME is an accepted synonym for ANY; by contrast, ALL against zero rows is vacuously true (nothing to fail the test) rather than false, and ANY against zero rows is false rather than true, since no comparison ever succeeded.

</details>

### querying-006

Two tables currently share only one column name, customer_id. A developer is deciding between JOIN ... USING (customer_id) and NATURAL JOIN. What risk is specific to NATURAL JOIN that USING avoids?

- **A.** NATURAL JOIN is fundamentally incompatible with LEFT, RIGHT, or FULL outer joins and can only ever legally be paired with a plain INNER JOIN, whereas USING can be freely combined with any of the three outer join variants as well.
- **B.** NATURAL JOIN always degrades into a full Cartesian product instead of matching rows on the shared column name.
- **C.** USING requires every single column in both tables to share an identical name, not merely the columns actually being joined on.
- **D.** If either table later gains a new column whose name happens to match one in the other table, NATURAL JOIN silently pulls that column into the join condition, while USING only ever combines the columns actually named in the query.

<details><summary>Answer</summary>

**D.** — NATURAL builds its join condition from every column name the two tables happen to share, so an unrelated later schema change that introduces a matching column name silently changes the query's results; USING and ON are unaffected because they only ever combine the columns actually named.

</details>

### querying-007

In WITH monthly_totals AS (...), big_spenders AS (SELECT customer_id FROM monthly_totals WHERE ...) SELECT ... FROM big_spenders;, what governs which parts of the query are allowed to reference which?

- **A.** Only the primary statement may reference a CTE; auxiliary statements within the same WITH clause can never reference one another.
- **B.** A later auxiliary statement may reference one defined earlier in the same WITH clause, and the primary statement may reference any of them.
- **C.** CTEs may reference each other in either direction, earlier referencing later or later referencing earlier, with no restriction at all.
- **D.** A CTE may only be referenced from inside a nested subquery of the primary statement, never directly in its top-level FROM clause.

<details><summary>Answer</summary>

**B.** — Each auxiliary statement in a WITH clause behaves like a temporary table available to statements that follow it, so big_spenders can draw on monthly_totals, and the primary query can in turn draw on either of the named auxiliary statements.

</details>

### querying-008

The documentation notes that, despite its name, a WITH RECURSIVE query is not evaluated through actual recursive function calls. How is it actually carried out?

- **A.** Step by step: the non-recursive term first populates a working table, and then the recursive term keeps re-running against whatever the working table currently holds, stopping the moment a round contributes zero additional rows.
- **B.** By unrolling every level of recursion in advance into one giant non-recursive UNION ALL before the query ever runs.
- **C.** By spawning one backend process per recursion level and merging their individual outputs together at the end.
- **D.** By running the non-recursive term and the recursive term simultaneously on separate parallel worker threads, periodically merging whatever partial rows each thread has produced so far until their outputs finally converge.

<details><summary>Answer</summary>

**A.** — PostgreSQL seeds a working table from the non-recursive term, then repeatedly substitutes that working table into the recursive term and folds each round's fresh output back in, terminating naturally once a round produces nothing new — an iterative process rather than true recursion.

</details>

### querying-009

A recursive CTE definition is followed by SEARCH DEPTH FIRST BY id SET ordercol before the primary SELECT. What does this clause actually accomplish?

- **A.** It rewrites the recursive term's join condition so that the underlying traversal algorithm itself proceeds in depth-first order.
- **B.** It converts UNION ALL into UNION automatically, so duplicate rows are discarded before any sorting happens.
- **C.** It is expanded internally into essentially the same visited-path-array bookkeeping a developer would otherwise hand-write, and it adds the named column to the CTE's output so the final result can be sorted by it.
- **D.** It replaces the need for a primary-query ORDER BY clause, guaranteeing that the client application always receives the CTE's rows already sorted in true depth-first traversal order.

<details><summary>Answer</summary>

**C.** — SEARCH DEPTH FIRST is sugar for the manual technique of carrying an ever-growing array of visited rows and sorting by it afterward; the clause does not change the order rows are actually produced during evaluation, only the value in the added column that a later ORDER BY can use.

</details>

### querying-010

Appending CYCLE id SET is_cycle USING path to a recursive CTE adds two columns to its output. What do those two columns represent?

- **A.** A count of how many times autovacuum has touched the underlying tables, and a boolean flagging whether that count exceeded a threshold.
- **B.** A path column of visited ids and a boolean is_cycle column flagging whenever the current row would repeat an id already on that path.
- **C.** A single boolean column reporting whether the query as a whole looped forever; the path keyword contributes no column of its own.
- **D.** A depth counter tracking how many recursive rounds have run, and a boolean marking whether a configured maximum depth was reached.

<details><summary>Answer</summary>

**B.** — CYCLE is internally rewritten into the same pattern as manually carrying an array of already-visited keys and checking each new row against it; the path and is_cycle columns it adds are exactly that visited-array and its derived cycle flag.

</details>

### querying-011

Which of the following statements about CTE materialization are accurate? *(choose three)*

- **A.** By default, a non-recursive, side-effect-free CTE that the parent query references exactly once is folded directly into the parent query's plan, letting an outer restriction be pushed down into it.
- **B.** Materialization behavior only ever applies to recursive CTEs; a non-recursive CTE is always inlined no matter how many times the parent references it.
- **C.** Using NOT MATERIALIZED always improves performance, because inlining a CTE's body can never cause that body to be evaluated more than once.
- **D.** By default, once the same CTE is referenced more than once by the parent query, PostgreSQL computes it a single time into a temporary result and reuses that result for every reference.
- **E.** The MATERIALIZED keyword can force a CTE to be computed separately even when it is referenced only once, which matters when the CTE's body calls an expensive or side-effecting function that must run exactly once.

<details><summary>Answer</summary>

**A.** **D.** **E.** — A once-referenced, side-effect-free CTE is folded into the parent plan by default, while a multiply-referenced one is materialized by default; MATERIALIZED overrides that default to force separate computation. NOT MATERIALIZED can instead cause duplicate computation, so it is not a universal win, and the folding behavior is not limited to recursive CTEs.

</details>

### querying-012

In WITH purged AS (DELETE FROM sessions WHERE expires_at < now() RETURNING *) INSERT INTO sessions_archive SELECT * FROM purged;, what actually makes the deleted rows available to the outer INSERT?

- **A.** PostgreSQL automatically re-queries the sessions table for any row matching the DELETE's WHERE condition.
- **B.** The DELETE's RETURNING clause is what forms the temporary result the rest of the query can draw on; a data-modifying statement in WITH that lacks RETURNING produces no such result to reference.
- **C.** The sessions table itself becomes directly selectable through the name purged even without RETURNING, since PostgreSQL treats every WITH sub-statement as automatically exposing its full target table.
- **D.** The WITH clause first converts the DELETE into an equivalent SELECT and only performs the actual deletion afterward, as a separate side effect.

<details><summary>Answer</summary>

**B.** — It's the output of RETURNING — not the DELETE's target table — that becomes the temporary result purged refers to; a data-modifying WITH statement that omits RETURNING still runs to completion but leaves nothing behind for the rest of the query to select from.

</details>

### querying-013

A GROUP BY group ends up with zero contributing rows for a particular aggregate call. What do sum() and array_agg() return for that group, and how does count() differ?

- **A.** sum() and array_agg() both return null rather than 0 or an empty array; coalesce is needed to substitute a default explicitly, which is why the note singles out count() as behaving differently by returning 0 in the same situation.
- **B.** sum() returns 0 and array_agg() returns an empty array, matching the intuition most programmers bring from other languages.
- **C.** sum() raises a runtime error over an empty input, while array_agg() quietly returns an empty array without complaint.
- **D.** sum() returns null, but array_agg() still returns an empty array rather than null, since arrays and numbers are handled differently.

<details><summary>Answer</summary>

**A.** — Except for count(), these aggregate functions return null over zero rows — sum() of no rows is null, not zero, and array_agg() of no rows is null, not an empty array — so code depending on a numeric or array result generally needs coalesce to supply a sensible default.

</details>

### querying-014

What is the key behavioral difference between percentile_cont(0.5) WITHIN GROUP (ORDER BY duration) and percentile_disc(0.5) WITHIN GROUP (ORDER BY duration)?

- **A.** percentile_cont is documented as only accepting integer-typed or bigint-typed columns for its WITHIN GROUP ORDER BY argument, while percentile_disc can accept any sortable data type at all.
- **B.** percentile_disc requires an accompanying GROUP BY clause in the surrounding query, whereas percentile_cont does not.
- **C.** percentile_cont ignores its WITHIN GROUP ORDER BY entirely and instead sorts using only its numeric fraction argument.
- **D.** percentile_cont may interpolate a value that falls between two adjacent inputs, while percentile_disc always returns one of the values that was actually present in the input.

<details><summary>Answer</summary>

**D.** — percentile_cont computes a continuous percentile and will interpolate between neighboring sorted values when the requested fraction lands between them, while percentile_disc's discrete percentile always lands on one genuine input value rather than an interpolated one.

</details>

### querying-015

A query includes both WHERE oi.ship_date > CURRENT_DATE - INTERVAL '30 days' and HAVING sum(oi.quantity * oi.unit_price) > 10000. Why can HAVING reference an aggregate result here while WHERE could not?

- **A.** HAVING is nothing more than an alternate spelling of WHERE; the two clauses are fully interchangeable in every query.
- **B.** Aggregate values are computed once for the whole table well before WHERE ever runs, so WHERE could technically reference them but the grammar simply forbids the syntax.
- **C.** WHERE is only permitted to reference aggregates in queries that also omit a GROUP BY clause entirely.
- **D.** WHERE filters individual rows before any grouping or aggregation has happened, while HAVING filters entire already-formed groups after aggregation has produced its results.

<details><summary>Answer</summary>

**D.** — WHERE operates on the raw rows coming out of FROM, ahead of grouping and aggregation, so there is no aggregate value yet for it to reference; HAVING runs afterward against the collapsed group rows, which is exactly why its conditions are free to use aggregate expressions.

</details>

### querying-016

Three rows tie for the second-highest salary in a department, ordered by salary descending. How do rank() and dense_rank() number those three tied rows and the row that follows them?

- **A.** rank() assigns the tied rows three separate, consecutive numbers, while dense_rank() assigns all three of them the very same number.
- **B.** Both functions are documented as assigning a strictly increasing, unique number to every single row, ties included, which makes them behave in every respect exactly like row_number() does.
- **C.** rank() and dense_rank() are simply two different names PostgreSQL provides for calling the identical ranking function.
- **D.** Both give the three tied rows the same number, but rank() then jumps ahead by the size of that tie for the next row, while dense_rank() just continues with the next consecutive integer.

<details><summary>Answer</summary>

**D.** — rank() numbers peer groups (tied rows sharing the same ORDER BY value) identically but leaves a gap afterward equal to the tie's size, whereas dense_rank() also numbers peer groups identically but never leaves a gap, so it effectively just counts distinct peer groups.

</details>

### querying-017

sum(amount) OVER (ORDER BY sale_date) is used with no PARTITION BY and no explicit frame clause. What total does each row actually receive, and how could the query be changed to give every row the same whole-partition total instead?

- **A.** Each row already receives the sum computed across the entire result set on every single call it makes, because sum() used together with an OVER clause is documented as always completely ignoring any ORDER BY clause entirely, unless a PARTITION BY clause has also been separately supplied alongside it within that same window definition.
- **B.** PostgreSQL raises an error, since sum() OVER demands an explicit frame clause the moment ORDER BY appears in the OVER clause.
- **C.** Each row gets a running, cumulative total through its own peer group, since the omitted frame clause defaults to a frame running from the partition's first row through the current row; dropping ORDER BY, or adding ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING, yields the whole-partition total instead.
- **D.** Each row gets a running total, and once ORDER BY appears in the OVER clause there is no way to recover a true whole-partition total.

<details><summary>Answer</summary>

**C.** — Supplying ORDER BY without a frame clause quietly sets the lower bound of the frame all the way back to row one of the partition and the upper bound to wherever the current row's peers end, producing a running total; omitting ORDER BY, or overriding the frame explicitly, switches the frame back to the whole partition.

</details>

### querying-018

Which of the following statements about how window functions interact with the rest of a query are accurate? *(choose two)*

- **A.** Window functions are evaluated only after any grouping, aggregation, and HAVING filtering have already run, so whenever a query also uses GROUP BY, a window function sees the already-collapsed group rows rather than the original per-row data.
- **B.** A window function's arguments can never include a call to a plain aggregate function, since ordinary aggregates are evaluated after window functions, not before.
- **C.** Because window functions are evaluated last, a WHERE clause in that same SELECT can reference a window function's result directly, with no subquery needed.
- **D.** Filtering or grouping on a window function's output has to happen by wrapping the windowed query in a subquery (or CTE) and applying the condition against that outer query instead.
- **E.** A GROUP BY clause may directly group rows by a window function's output column, since window functions are documented as running before GROUP BY is applied.

<details><summary>Answer</summary>

**A.** **D.** — Window functions run after grouping/aggregation/HAVING, and a call to one may only be written in a query's output column list or its outer ORDER BY — it is rejected anywhere in WHERE, GROUP BY, or HAVING — so filtering on their output requires an outer subquery; conversely, since ordinary aggregates run before window functions, a window function's arguments may legally include an aggregate call.

</details>

### querying-019

A query chains data->'address'->'city' and needs the final result as a plain text value for display. Why does the last step in a chain like this typically switch from -> to ->>?

- **A.** -> and ->> are fully interchangeable operators; swapping one for the other never changes the result's type.
- **B.** ->> is documented as only ever being legally usable as the very first operator applied directly to a jsonb column, and it can never legitimately appear later in a chain after a preceding -> call.
- **C.** -> keeps returning its extracted piece wrapped as json or jsonb, so it can be chained into a further -> or ->> call, while ->> converts that final extracted piece into plain text instead.
- **D.** -> always fails with an error once it is applied to a nested object, which is why ->> has to be substituted at every step of the chain.

<details><summary>Answer</summary>

**C.** — -> hands back its result still wrapped as json/jsonb so a query can keep drilling further into nested structure, while ->> hands back that same extracted piece already converted to text, which is generally what a final display step wants.

</details>

### querying-020

A jsonb column stores {"foo": {"bar": "baz"}}. Why does data @> '{"bar": "baz"}' evaluate to false, even though the pair bar/baz clearly exists somewhere inside the stored document?

- **A.** Containment requires the right-hand structure to match the containing document at the same nesting level; bar sits one level down inside foo, not at the top level where the right-hand object lives.
- **B.** The @> operator only ever works when both sides are jsonb arrays; it is simply undefined for jsonb objects.
- **C.** Containment checks are documented as plain case-sensitive character comparisons applied across the whole document, and "bar" simply fails to match some differently-cased key that appears elsewhere within it.
- **D.** Any object used on the right-hand side of @> must first be wrapped in a one-element array, or the containment test automatically fails.

<details><summary>Answer</summary>

**A.** — jsonb containment matches structure and content at corresponding nesting levels, possibly discarding extra keys or array elements along the way — but it does not search recursively through arbitrary depth, so a pair nested one level down does not satisfy a top-level containment check.

</details>

### querying-021

jsonb_set(target, '{a,b,c}', new_value) is called on a target that has a top-level key "a", but that value has no nested key "b" at all — an earlier step in the path is missing entirely. What does jsonb_set return?

- **A.** new_value gets inserted at whatever point in the structure was reached before the path ran out, silently discarding the remaining path segments.
- **B.** An object with an empty "b": {} gets created automatically so the rest of the path has somewhere to attach new_value.
- **C.** PostgreSQL raises an error immediately, since jsonb_set can never tolerate any missing intermediate step in its path argument.
- **D.** target itself, completely unchanged, because every step of the path before its final segment must already exist in the document.

<details><summary>Answer</summary>

**D.** — jsonb_set only ever creates or replaces the final item named by path; every step leading up to that final one must already be present in the document, or the call is a no-op that hands back the original target untouched.

</details>

### querying-022

The identical JSON text '{"bar": "baz", "balance": 7.77, "active":false}' is cast once to json and once to jsonb, and both are printed back out with no other processing. Why do the two printed results end up with different key order and spacing?

- **A.** Both types are documented to always reprint the exact original input text, so any observed difference would indicate a bug.
- **B.** json keeps a literal copy of whatever text was supplied, preserving key order and whitespace, while jsonb reparses the input into a decomposed internal form and does not preserve those semantically-insignificant details.
- **C.** jsonb is actually the type that reprints the original input text completely unchanged, while json is the one that normalizes key order, since json is documented as the less compact, less storage-efficient of the two formats.
- **D.** Neither type preserves any part of the original input; both regenerate their output using a fixed, always-alphabetical key ordering.

<details><summary>Answer</summary>

**B.** — json stores and echoes back exactly the text it was given, keys, spacing, and all, whereas jsonb decomposes that text into its own internal representation at write time, which is why reordered keys and stripped whitespace are semantically equal even though the printed text differs.

</details>

### querying-023

Which of the following statements about PostgreSQL full-text search are accurate? *(choose two)*

- **A.** A GIN index built as CREATE INDEX ... USING GIN (to_tsvector('english', body)) will also be used by a query filtering on WHERE to_tsvector(body) @@ ..., since both calls invoke to_tsvector on the same source column.
- **B.** The <-> (FOLLOWED BY) tsquery operator only matches when its two arguments' matches are adjacent and in the given order, which is the mechanism phraseto_tsquery relies on to build multi-word phrase queries.
- **C.** A tsquery is built straight from raw, unnormalized search text, and @@ compares that raw text directly against a document's original, unprocessed wording.
- **D.** GIN is the only index type PostgreSQL ever supports for accelerating full-text search; GiST cannot be used for this purpose at all.
- **E.** Because to_tsquery normalizes its search terms using the same rules to_tsvector applies to documents, a query built from the word "error" correctly matches a document that only contains the word "errors".

<details><summary>Answer</summary>

**B.** **E.** — FOLLOWED BY genuinely requires adjacency and order, and shared normalization is why a stemmed search term like error matches errors in the document; by contrast, an index built on the two-argument to_tsvector form is only used by queries written with that identical two-argument form (a bare to_tsvector(body) call cannot use it), tsquery terms must go through normalization rather than being compared as raw text, and GiST is also documented as usable for text search indexes alongside GIN.

</details>

### querying-024

Which of the following statements about INSERT ... ON CONFLICT (upsert) are accurate? *(choose three)*

- **A.** Exclusion constraints are fully usable as arbiters for both ON CONFLICT DO NOTHING and ON CONFLICT DO UPDATE, exactly like unique indexes and unique constraints.
- **B.** ON CONFLICT DO UPDATE must name a conflict_target explicitly, while ON CONFLICT DO NOTHING may omit one, in which case it handles conflicts against any usable constraint or unique index on the table.
- **C.** A DEFERRABLE unique constraint can still serve as an arbiter for ON CONFLICT, since deferrability only changes when the constraint is checked, not whether it is eligible to arbitrate.
- **D.** Inside an ON CONFLICT DO UPDATE clause, the special EXCLUDED pseudo-table refers to the row that was proposed for insertion, so a clause like SET quantity = inventory.quantity + EXCLUDED.quantity can merge the new value into the row already on disk.
- **E.** ON CONFLICT DO UPDATE is guaranteed atomic: under concurrent activity, the outcome for a given row is always either a clean insert or a clean update, never a lost update and never a spurious duplicate-key error.

<details><summary>Answer</summary>

**B.** **D.** **E.** — A conflict_target is mandatory for DO UPDATE but optional for DO NOTHING, EXCLUDED exposes the row that was about to be inserted for merge-style updates, and the whole operation is documented as atomic; by contrast, a constraint or index can arbitrate only when it is not deferrable, which rules out both deferrable unique constraints and, specifically for the DO UPDATE form, exclusion constraints altogether.

</details>

## Indexing & Performance

24 questions

### indexing-001

Which set of query conditions can the planner satisfy using a B-tree index, per the documentation?

- **A.** Only exact equality tests using the = operator; every other comparison always forces a full sequential scan of the table instead.
- **B.** Any LIKE pattern at all, no matter where its wildcard character happens to sit within the string, since B-tree performs full pattern matching internally.
- **C.** Comparisons using <, <=, =, >=, or >, plus BETWEEN/IN, IS NULL/IS NOT NULL, and a left-anchored LIKE pattern such as col LIKE 'foo%'.
- **D.** Containment tests, such as the @> and <@ operators used to check array or range membership.

<details><summary>Answer</summary>

**C.** — B-tree handles the ordering operators (<, <=, =, >=, >) plus constructs built from them, IS [NOT] NULL, and patterns anchored at the string's start such as 'foo%' — though outside the C locale that pattern-matching support requires building the index with a special operator class such as text_pattern_ops. A pattern with a leading wildcard, like '%bar', cannot use the index at all; containment operators like @> belong to GiST/GIN operator classes instead, and equality-only lookups describe Hash, not B-tree.

</details>

### indexing-002

Which of the following are accurate properties or limitations of PostgreSQL Hash indexes, per the documentation? *(choose two)*

- **A.** A hash index supports only single-column indexing; it cannot be built across more than one column of a table.
- **B.** A hash index can be declared UNIQUE, exactly like a B-tree index, since only GIN and BRIN indexes are restricted from enforcing uniqueness.
- **C.** A hash index can accelerate a range condition such as WHERE col > 100, in addition to plain equality.
- **D.** Because a hash index tuple stores only the 4-byte hash of the indexed value rather than the value itself, a hash index can be considerably smaller than a B-tree when indexing long values such as UUIDs.
- **E.** A hash index can satisfy an ORDER BY clause on the indexed column without requiring PostgreSQL to add a separate explicit sort step.

<details><summary>Answer</summary>

**A.** **D.** — The documentation restricts the ability to be declared unique to the B-tree access method, notes a hash index is limited to one column and the equality operator alone (no range queries), and says sorted-output ORDER BY support is a B-tree-only capability — but since a hash tuple stores just a 4-byte hash rather than the original value, it can be much smaller than a B-tree for long indexed values like UUIDs.

</details>

### indexing-003

What kind of index access method is GiST, per the documentation?

- **A.** A balanced tree access method that serves as a base template for schemes like B-trees and R-trees, also supporting nearest-neighbor <-> ordering searches.
- **B.** A structure that stores only a fixed-width digest of each indexed value, making it usable for equality lookups but nothing else, much like a hash index.
- **C.** An index type restricted to two-dimensional geometric data types only, with no mechanism at all for anyone to define additional custom operator classes.
- **D.** Unlike BRIN, a GiST index scan is always exact, and the executor never needs to recheck any candidate row against the original query condition.

<details><summary>Answer</summary>

**A.** — GiST is described as a generalized, balanced tree-structured access method that serves as infrastructure for many indexing strategies (B-trees, R-trees, and more) and supports nearest-neighbor searches via ordering operators; it is not limited to geometric types, and it is not always exact — the documentation's own polygon-containment example shows a GiST scan returning overlapping candidates that the executor must recheck, so lossy behavior is not unique to BRIN.

</details>

### indexing-004

How does a GIN index represent an indexed composite value, such as an array, per the documentation's description of it as a Generalized Inverted Index?

- **A.** It stores one B-tree leaf entry per row, containing a complete serialized copy of that row's entire array value, much like a B-tree index built on a plain scalar column.
- **B.** It stores a single summary bitmap per block range and leaves all correctness checking entirely up to the query executor at scan time.
- **C.** It stores a hash of the entire composite value and can only test whether two given arrays are completely identical to one another.
- **D.** For each distinct key found across the indexed items, it keeps one (key, posting-list) entry whose posting list records every row ID containing that key.

<details><summary>Answer</summary>

**D.** — GIN is an inverted index: it stores one entry per distinct key extracted from the indexed items, with each entry's posting list recording every row containing that key, so a key shared by many rows is stored compactly rather than duplicated per row; the option describing a single per-block-range summary bitmap describes BRIN's block-range summaries, and the option describing a hash of the whole value that can only test for exact identity describes an equality-only hash-style structure, neither of which matches GIN.

</details>

### indexing-005

The documentation notes that BRIN indexes work best when a column's values correlate with the physical row order of the table. For which of these columns would a BRIN index be a poor structural fit?

- **A.** An order_date column in a sales table, where earlier orders tend, in practice, to occupy earlier physical positions in the table.
- **B.** A randomly-generated UUID primary key with no relationship to insertion order.
- **C.** A ZIP code column where rows belonging to the same city are physically grouped together.
- **D.** A large, monotonically increasing bigint identity column whose values grow in the same order that rows are inserted.

<details><summary>Answer</summary>

**B.** — BRIN summarizes each physical block range with min/max-style data, so it is only useful when the indexed value tracks physical storage order; a randomly-ordered UUID column has no such correlation, making BRIN a poor fit — that is the trap of assuming BRIN behaves like a smaller B-tree. The other columns (order date, grouped ZIP codes, a monotonic identity column) are exactly the kind of naturally-correlated data the documentation cites as good BRIN candidates.

</details>

### indexing-006

Per the documentation, what must happen after a BRIN index scan identifies which block ranges might contain matching rows?

- **A.** The executor must recheck each returned tuple against the actual query condition and discard non-matches, since BRIN summaries are lossy.
- **B.** Nothing further is required: BRIN summaries record the exact indexed value for every row, so every returned tuple is guaranteed to satisfy the condition.
- **C.** The table must first be reorganized with a CLUSTER command before any BRIN scan result can be trusted at all.
- **D.** A recheck is required only for range conditions like < or >; equality conditions against a BRIN index never require rechecking a row.

<details><summary>Answer</summary>

**A.** — BRIN scans return every tuple in a block range whenever the range's summary is consistent with the query condition, and the executor is documented as being in charge of rechecking those tuples and discarding non-matches — in the documentation's own words, these indexes are lossy. This recheck requirement is not limited to range conditions, and it isn't solved by clustering the table or contradicted by any claim that BRIN stores exact per-row values.

</details>

### indexing-007

In the documentation's access_log example, an index on client_ip is created with a WHERE clause that excludes the organization's own internal IP subnet. What benefit does this partial index provide?

- **A.** It guarantees client_ip values are globally unique across the entire table, serving as a substitute for a UNIQUE constraint.
- **B.** PostgreSQL requires every index on an inet-typed column to carry a WHERE clause, or the CREATE INDEX statement is rejected outright.
- **C.** Excluding a common value keeps the index smaller, speeding up both the searches that use it and its update maintenance.
- **D.** It lets a query for an address inside the excluded subnet still use this index, something a full, non-partial index could never do.

<details><summary>Answer</summary>

**C.** — Common values already tend not to use an index, so omitting them from a partial index only shrinks the index (helping both lookups and maintenance) without losing any real benefit; the example is about size and update overhead, not uniqueness, and a query for an address inside the excluded subnet is exactly the case this partial index cannot serve, since that IP was deliberately left out.

</details>

### indexing-008

According to the documentation, when can a query actually use a partial index's predicate to be considered applicable?

- **A.** Whenever the query touches any column of the table the partial index was built on, regardless of whether the WHERE clauses relate to each other at all.
- **B.** Only when the planner can recognize, at planning time, that the WHERE condition mathematically implies the index's predicate, such as x < 1 implying x < 2.
- **C.** Only at query execution time, when each candidate row is individually tested against both the query condition and the index predicate.
- **D.** PostgreSQL includes a general theorem prover capable of recognizing any two WHERE conditions that are logically equivalent, however differently they are phrased.

<details><summary>Answer</summary>

**B.** — The documentation explicitly denies having a general theorem prover, states that predicate matching happens at planning time (not execution time, and not via a per-row runtime test), and gives the "x < 1 implies x < 2" case as the kind of simple inequality it can recognize — explaining why a prepared statement's parameterized "x < $1" clause can never be matched to a predicate like "x < 2".

</details>

### indexing-009

Applying the documentation's partial-unique-index pattern to a hiring table, CREATE UNIQUE INDEX hires_once_idx ON job_applications (candidate_id, position_id) WHERE hired; accomplishes what?

- **A.** It enforces uniqueness of the (candidate_id, position_id) pair across every single row of the table, no matter what value is stored in hired.
- **B.** It prevents the table from ever containing more than one single row where the hired column happens to be false.
- **C.** It behaves as a NOT NULL constraint on the hired column, rejecting any inserted row where hired is left null.
- **D.** It enforces uniqueness of (candidate_id, position_id) only among rows where hired is true; other rows are left unconstrained and may repeat freely.

<details><summary>Answer</summary>

**D.** — A unique partial index only enforces uniqueness among the rows that satisfy its WHERE predicate; here that means only "hired" (candidate, position) combinations must be unique, while any number of not-hired applications for the same pairing are unconstrained — this mirrors the documentation's own subject/target "successful test" example, and it says nothing about NOT NULL and does not limit how many false rows can exist.

</details>

### indexing-010

The documentation warns against building one partial index per category value across a whole set of non-overlapping categories (mytable_cat_1, mytable_cat_2, ... mytable_cat_N), calling it a bad idea. What does it recommend instead, and why?

- **A.** A single BRIN index instead, because BRIN summaries can inherently distinguish which category each block range belongs to.
- **B.** This exact pattern of one partial index per category is actually endorsed as best practice whenever there are more than three category values.
- **C.** A single ordinary multicolumn index, such as (category, data), which avoids the per-query planning overhead of testing each partial index.
- **D.** Merging all of the per-category partial indexes together into a single GIN index built over just the category column.

<details><summary>Answer</summary>

**C.** — The documentation calls the per-category partial-index scheme a bad idea because PostgreSQL does not understand the relationship between the partial indexes and must test each one individually, and it recommends a single non-partial multicolumn index (category first) instead, reserving actual table partitioning for cases where even one index proves too large — nothing in the passage suggests BRIN or GIN as the fix.

</details>

### indexing-011

What is the main trade-off of indexing an expression, such as CREATE INDEX accounts_lower_email_idx ON accounts (lower(email));, rather than indexing the plain column, per the documentation?

- **A.** They cost a bit more to maintain, since the expression is recomputed on every insert or non-HOT update, but reads stay fast.
- **B.** The expression is recomputed by the planner every time a matching SELECT runs, which slows down reads compared to a plain column index.
- **C.** Expression indexes cannot be declared UNIQUE, so lower(email) could never be used to enforce case-insensitive uniqueness on a column.
- **D.** Parentheses around the indexed expression must always be omitted, even for a multi-argument computation like a concatenated full-name expression.

<details><summary>Answer</summary>

**A.** — The documentation states expression indexes add write-time cost (recomputing the expression for every insert/non-HOT update) but not read-time cost, since the value is already stored in the index at search time; it also explicitly shows declaring such an index UNIQUE (using its own lower(col1) example) to enforce case-insensitive uniqueness, and says parentheses can be omitted only for a bare function call, not for arbitrary expressions like a concatenation.

</details>

### indexing-012

Which of the following statements about partial or expression indexes are accurate, per the documentation? *(choose three)*

- **A.** Declaring lower(col1) as a UNIQUE index would prevent inserting rows whose col1 values differ only in letter case, effectively enforcing a case-insensitive uniqueness rule.
- **B.** Because expression indexes store their computed values, the executor still has to recompute the underlying expression for every candidate row it inspects, so expression indexes never save any CPU time during query execution.
- **C.** A partial index's predicate expression may reference only columns belonging to the table being indexed; it cannot reference other tables.
- **D.** A partial index predicate must be a simple equality test; PostgreSQL does not support arbitrary boolean expressions as predicates.
- **E.** A column can be limited to holding just one null value by making a unique index partial, restricted with an IS NULL condition in its predicate.

<details><summary>Answer</summary>

**A.** **C.** **E.** — The documentation confirms a UNIQUE index on lower(col1) blocks case-only duplicates, that partial-index predicates may only involve columns of the indexed table, and that restricting a unique partial index to an IS NULL condition can cap a column at a single null value — but it explicitly says expression values are not recomputed during an indexed search, which is why the option claiming expression indexes must recompute the expression for every candidate row and therefore never save CPU time is false, and it says PostgreSQL "supports partial indexes with arbitrary predicates" rather than equality only, which is why the option claiming a partial-index predicate must be a simple equality test is also false.

</details>

### indexing-013

What is the fundamental difference between a plain EXPLAIN and an EXPLAIN ANALYZE, per the documentation and grounding notes?

- **A.** EXPLAIN ANALYZE only works on SELECT statements, whereas plain EXPLAIN also works on INSERT, UPDATE, DELETE, and MERGE statements.
- **B.** Plain EXPLAIN only prints the planner's estimated plan without running the statement, while EXPLAIN ANALYZE actually executes it and reports true row counts and run times too.
- **C.** Plain EXPLAIN silently executes the query and discards its output rows, while EXPLAIN ANALYZE never actually runs the query and only estimates.
- **D.** EXPLAIN ANALYZE never triggers a data-modifying statement's real side effects; it only simulates them for inspection purposes only.

<details><summary>Answer</summary>

**B.** — EXPLAIN alone estimates a plan without running it; EXPLAIN ANALYZE actually executes the statement, which is why the documentation recommends wrapping a data-modifying statement in BEGIN/ROLLBACK if you want to inspect its plan without keeping its side effects — those side effects genuinely happen, and EXPLAIN ANALYZE works on INSERT/UPDATE/DELETE/MERGE just as well as SELECT.

</details>

### indexing-014

A table has 500 disk pages and 20000 rows. Using the documented sequential-scan cost formula (pages × seq_page_cost) + (rows × cpu_tuple_cost) with unmodified default settings (seq_page_cost = 1.0, cpu_tuple_cost = 0.01), what total cost would EXPLAIN report for a plain sequential scan of the whole table?

- **A.** 500, counting only the page-fetch term and ignoring the per-row term entirely.
- **B.** 200, counting only the per-row term and ignoring the page-fetch term entirely.
- **C.** 600, from mistakenly applying cpu_index_tuple_cost (0.005) instead of cpu_tuple_cost to the row count.
- **D.** 700, from (500 × 1.0) + (20000 × 0.01) = 500 + 200.

<details><summary>Answer</summary>

**D.** — Following the documented formula exactly: (500 pages × 1.0 seq_page_cost) + (20000 rows × 0.01 cpu_tuple_cost) = 500 + 200 = 700, matching how the tenk1 example (345 pages, 10000 rows) is shown arriving at cost 445.

</details>

### indexing-015

What is the documented default value of random_page_cost relative to seq_page_cost, and what does that default reflect?

- **A.** random_page_cost defaults to 4.0 against seq_page_cost's 1.0, lower than random access truly costs, since most random reads are assumed cached.
- **B.** random_page_cost defaults to 1.0, identical to seq_page_cost, on the assumption that all storage is solid-state and access patterns no longer matter.
- **C.** random_page_cost defaults to 10.0, deliberately set high to discourage the planner from ever choosing an index scan at all.
- **D.** Setting random_page_cost below seq_page_cost is rejected outright by the server as an invalid configuration value.

<details><summary>Answer</summary>

**A.** — The documentation gives seq_page_cost a default of 1.0 and random_page_cost a default of 4.0, explicitly noting that plain random access is normally much more expensive than 4x sequential access but a lower default is used because most random reads are assumed to already be cached; it also notes the server will let you set random_page_cost below seq_page_cost even though doing so is not physically sensible, so that is not rejected outright.

</details>

### indexing-016

In the documentation's worked example, WHERE unique1 = 42 produces a plain Index Scan plan rather than a Bitmap Heap/Bitmap Index Scan combination. Why does the planner prefer the plain Index Scan here?

- **A.** A plain Index Scan never needs to visit the table heap at all, so it is unconditionally cheaper than any bitmap-based plan whatsoever, in every case.
- **B.** Bitmap Heap Scan cannot be used to satisfy an equality condition; it is only ever chosen for range conditions such as < or > instead.
- **C.** So few rows match that skipping the bitmap-build-and-sort step outweighs the extra cost of fetching those few rows directly in index order.
- **D.** The planner automatically disables all bitmap-scan plans whenever a query happens to have no LIMIT clause attached to it.

<details><summary>Answer</summary>

**C.** — The documentation notes that fetching rows in index order is more expensive per row, but when so few rows qualify, that extra cost is smaller than the overhead of building and sorting a bitmap — this is why plain Index Scan plans are common for single-row lookups and for queries whose ORDER BY matches the index; a plain Index Scan can still require heap visits (it is not an index-only scan by default), and bitmap scans are used for equality predicates elsewhere in the same set of examples.

</details>

### indexing-017

Per the documentation's caveats on EXPLAIN ANALYZE, why might costs and timings measured on a small, 'toy-sized' table be misleading if extrapolated to a much larger table?

- **A.** EXPLAIN ANALYZE always silently reuses cached statistics from whichever other table in the database happens to be the largest one.
- **B.** Cost estimates are nonlinear, so the chosen plan can differ by table size; a one-page table will nearly always get a sequential scan regardless of indexes.
- **C.** EXPLAIN ANALYZE rounds every reported cost to the nearest whole disk-page fetch, which hides any effect table size might have.
- **D.** Table size has no bearing whatsoever on which plan the planner selects; only the width of each row affects the chosen plan.

<details><summary>Answer</summary>

**B.** — The documentation explicitly warns that results should not be extrapolated to a much different situation because planner cost estimates are nonlinear, and gives the one-page table as the extreme case where a sequential scan nearly always wins regardless of indexes — there is no statement about reusing another table's statistics or rounding costs to whole pages.

</details>

### indexing-018

Which of the following statements about the EXPLAIN command and its ANALYZE option are accurate, per the documentation? *(choose two)*

- **A.** Running EXPLAIN ANALYZE on an UPDATE statement is always safe and never changes the table's data, even without wrapping it in a transaction.
- **B.** GENERIC_PLAN can be combined with ANALYZE to actually execute a generic plan built from parameter placeholders.
- **C.** The Planning Time reported by EXPLAIN ANALYZE includes the time spent parsing and rewriting the query, in addition to planning it.
- **D.** EXPLAIN ANALYZE reports both the planner's cost estimates and the actual measured row counts and run times observed for each plan node.
- **E.** The BUFFERS option is automatically turned on whenever ANALYZE is used, though it can be explicitly disabled if that output is not wanted.

<details><summary>Answer</summary>

**D.** **E.** — EXPLAIN ANALYZE genuinely reports both estimated and actual figures, and BUFFERS is implicitly enabled by ANALYZE but can be turned off explicitly — however, the documentation warns that EXPLAIN ANALYZE really does execute a data-modifying statement (recommending BEGIN/ROLLBACK if you don't want the change kept), states GENERIC_PLAN cannot be combined with ANALYZE, and states Planning Time excludes parsing and rewriting.

</details>

### indexing-019

For a multicolumn B-tree index defined as (major, minor), which statement about how effectively it can be used is accurate per the documentation?

- **A.** The index is equally efficient no matter which of its columns the query constrains, exactly like a GIN or BRIN index would be instead.
- **B.** The index can be used only when the query supplies an equality constraint on every single one of its columns at the same time.
- **C.** Constraints on columns to the right of the leading columns are ignored entirely by the index and always force a separate filter against the table itself.
- **D.** It works on any subset of its columns, but is most efficient with constraints on the leading (leftmost) columns, which limit the range scanned.

<details><summary>Answer</summary>

**D.** — A B-tree index spanning several columns remains usable when a query constrains only some of them, but leading-column equality constraints (plus a trailing inequality) are what narrow the scanned range; trailing-column constraints are still checked inside the index (saving table visits) even though they don't necessarily shrink the scanned range — this leading-column sensitivity is explicitly contrasted with GIN and BRIN, whose effectiveness doesn't depend on which column is constrained.

</details>

### indexing-020

A table has separate single-column B-tree indexes on x and on y, with no combined index. Per the documentation, how can PostgreSQL satisfy WHERE x = 5 AND y = 6 using both of these separate indexes?

- **A.** It scans each index into its own in-memory bitmap, ANDs the bitmaps together, and then visits the resulting table rows, losing either index's ordering.
- **B.** PostgreSQL can only ever use one of the two indexes for a single given query, applying the other condition only as a plain filter on the table.
- **C.** Combining indexes this way always preserves the row order of whichever single index has the lower estimated cost of the two.
- **D.** A single index scan directly applies clauses joined by AND across two entirely different indexes without any intermediate bitmap step.

<details><summary>Answer</summary>

**A.** — The documentation describes exactly this bitmap AND/OR combination mechanism: each index is scanned into its own in-memory bitmap, the bitmaps are combined as the query requires, and because the resulting table rows are then visited in physical order (not either index's order), any ORDER BY still needs an explicit sort — a single index scan can only use clauses on its own indexed columns, not clauses spread across two separate indexes.

</details>

### indexing-021

What determines whether an index-only scan can avoid visiting the table heap for a given candidate row, even when the query references only indexed columns?

- **A.** Whether VACUUM FULL has ever been run against that particular table at any earlier point in its history.
- **B.** Whether the index in question happened to be originally built using the CONCURRENTLY option at creation time.
- **C.** The table's visibility map bit for that row's heap page, which records whether every row on the page is old enough to be visible to all transactions.
- **D.** Whether the query happens to be written using SELECT * rather than explicitly naming each of the individual columns it needs.

<details><summary>Answer</summary>

**C.** — Even when a query only needs indexed columns, PostgreSQL must still confirm each row is visible under MVCC; the visibility map tracks, per heap page, whether every row on that page is old enough to be visible to all transactions, and an index-only scan checks that bit before deciding whether it can skip the heap — VACUUM FULL history and the CONCURRENTLY build option aren't the documented mechanism, and naming only indexed columns is a separate prerequisite from the visibility-map check itself.

</details>

### indexing-022

What is the effect of adding total as an INCLUDE column, as in CREATE INDEX orders_customer_idx ON orders(customer_id) INCLUDE (total);, compared to making total an ordinary trailing key column as in orders(customer_id, total)?

- **A.** INCLUDE columns are indexed exactly like key columns and participate fully in both uniqueness enforcement and the index's overall sort ordering too.
- **B.** total becomes non-key 'payload', usable for index-only scans but not part of the search key, and a UNIQUE index would enforce uniqueness on customer_id alone.
- **C.** Adding total as an INCLUDE column always makes the index smaller than the equivalent plain multicolumn index orders(customer_id, total) would have been.
- **D.** Expressions are supported as INCLUDE columns just as freely as they are already supported as ordinary key columns.

<details><summary>Answer</summary>

**B.** — The documentation is explicit that an INCLUDE column is payload only — not part of the search key, not required to match an operator class, and excluded from a UNIQUE index's uniqueness condition — while also warning that non-key payload columns duplicate data and bloat index size rather than shrink it, and that INCLUDE does not currently accept an expression as one of its columns.

</details>

### indexing-023

Which of the following statements about index operator classes and index collations are accurate, per the documentation? *(choose three)*

- **A.** A single B-tree index column can support multiple collations simultaneously, so one index suffices regardless of which COLLATE clause a query specifies.
- **B.** An index column can specify an operator class, and a major reason multiple operator classes exist for one data type is that there can be more than one meaningful behavior for that type, such as ordering a complex-number type by magnitude in one class and by its real component in another.
- **C.** The text_pattern_ops family of operator classes compares values strictly character by character, which makes it usable for pattern-matching queries when the database isn't using the C locale, but ordinary <, <=, >, >= comparisons still need an index built with the default operator class.
- **D.** When the database uses the C locale, the xxx_pattern_ops operator classes become mandatory for any pattern-matching query to use an index.
- **E.** An operator family can group operator classes for different data types together, which is what enables cross-data-type operators to work with indexes even though those operators are not tied to any single class within the family.

<details><summary>Answer</summary>

**B.** **C.** **E.** — The documentation confirms operator classes exist because a type can have more than one meaningful indexed behavior, that xxx_pattern_ops classes do strict character comparison useful outside the C locale (while ordinary inequality comparisons still need a default-opclass index), and that operator families let cross-data-type operators participate in indexing — but it also states an index supports only one collation per column (so multiple collations need multiple indexes) and that the C locale specifically makes xxx_pattern_ops unnecessary, not mandatory.

</details>

### indexing-024

Which of the following are accurate recommendations from the documentation's guidance on examining and tuning index usage? *(choose two)*

- **A.** Testing with a very small data set is safe as long as the row count isn't zero, because the planner's cost estimates scale linearly with table size.
- **B.** Always run ANALYZE first: without it, the planner falls back to inaccurate default assumptions, making any conclusions drawn about index usage a lost cause.
- **C.** Temporarily disabling planner switches such as enable_seqscan can help confirm whether an index is being skipped for a fundamental reason, such as the query condition simply not matching the index at all.
- **D.** Inserting test data in sorted order, or making it completely random, produces the same planner statistics that a real production data distribution would.
- **E.** If forcing index usage through planner switches makes a query run faster, that alone proves the original cost estimates were accurate and no further investigation is warranted.

<details><summary>Answer</summary>

**B.** **C.** — The documentation calls skipping ANALYZE a 'lost cause' for tuning index usage and recommends toggling switches like enable_seqscan to diagnose why an index isn't chosen — but it separately warns that tiny test data sets are especially misleading (a table small enough to fit one disk page beats any index plan regardless), that sorted or fully random test data skews statistics away from a real distribution, and that a faster forced-index run only means one of two things (the planner was right to avoid the index, or its cost estimates are off) rather than proving the estimates were correct.

</details>

## Transactions & Concurrency (MVCC)

22 questions

### transactions-001

What is the main advantage the documentation gives for PostgreSQL's MVCC model over a purely lock-based approach to concurrency control?

- **A.** It removes any need for table- or row-level locking facilities, since every conflict is resolved automatically by comparing row versions.
- **B.** Locks taken for reading and locks taken for writing never conflict with each other, so readers never block writers and writers never block readers.
- **C.** It guarantees every session always operates on the single newest committed version of a row, discarding older versions as soon as a newer one exists.
- **D.** It requires every query to take out an explicit table lock before running, but resolves those locks faster than a traditional locking database would.

<details><summary>Answer</summary>

**B.** — MVCC's documented advantage is exactly that read-acquiring locks and write-acquiring locks are non-conflicting, so reads and writes never block each other, and PostgreSQL preserves that even under Serializable Snapshot Isolation — but table- and row-level locking facilities are still explicitly offered for cases where MVCC alone isn't the right fit, a query sees a frozen snapshot rather than always the newest row version, and MVCC's whole point is to avoid the need for query-time table locks, not to speed up their resolution.

</details>

### transactions-002

TRUNCATE, along with any ALTER TABLE variant that rewrites the table, is described in the documentation as not being safe under MVCC. Under what specific circumstance does the documentation say this will actually cause a concurrent transaction to see the affected table as unexpectedly empty?

- **A.** Whenever the concurrent transaction happens to be running under the default Read Committed isolation level at the moment the DDL commits.
- **B.** Whenever the concurrent transaction is explicitly querying the system catalogs rather than the table itself, regardless of when it started.
- **C.** Only when the DDL command is issued by a superuser, since ordinary roles are prevented from rewriting a table that other sessions are using.
- **D.** Only for a transaction that hadn't accessed the table before the DDL started — one that had would already hold a blocking lock.

<details><summary>Answer</summary>

**D.** — The caveat is narrowly scoped: a transaction that already accessed the target table before the DDL began would hold at least an ACCESS SHARE lock, which blocks TRUNCATE/table-rewriting ALTER TABLE from proceeding until that transaction finishes — so the empty-table surprise can only hit a transaction using an older snapshot that never touched the table beforehand. This has nothing to do with the isolation level of the concurrent transaction, is unrelated to whether that transaction is examining system catalogs, and has no documented dependency on who issued the DDL.

</details>

### transactions-003

A table is created by transaction A. Transaction B, running Repeatable Read, had already begun (and taken its snapshot) before A committed. Per the documentation, why can B immediately reference the new table by name, even though B cannot see any rows in it that were inserted after B's snapshot was taken?

- **A.** Internal catalog lookups ignore the current isolation level, so the table resolves normally, though its row contents still obey normal snapshot rules.
- **B.** Repeatable Read automatically takes a fresh snapshot the instant any DDL command commits elsewhere in the database.
- **C.** CREATE TABLE takes an ACCESS EXCLUSIVE lock that forces every other open transaction to immediately refresh its snapshot before it can continue.
- **D.** Queries that explicitly select from system catalog tables such as pg_class also bypass the current isolation level, so they too would show the new table immediately.

<details><summary>Answer</summary>

**A.** — The documentation attributes this to internal system-catalog access being exempt from the current transaction's isolation level — the object itself resolves normally even though its row contents obey normal snapshot rules. Repeatable Read does not re-snapshot mid-transaction whenever some unrelated DDL command commits, no lock forces other sessions to refresh their snapshots, and an explicit query against a catalog table like pg_class is the contrasting case described in the documentation — those queries do respect the isolation level and won't show a concurrently created object at the higher isolation levels.

</details>

### transactions-004

Which of the following statements about PostgreSQL's documented MVCC caveats are accurate? *(choose three)*

- **A.** TRUNCATE and any ALTER TABLE variant that rewrites the table fail to be MVCC-safe.
- **B.** An explicit query against the system catalogs, such as directly selecting from pg_class, will show rows for objects that were created by a transaction that committed after the querying transaction took its snapshot, even under Serializable.
- **C.** A transaction whose snapshot predates a concurrent TRUNCATE will nevertheless see the table as empty once that TRUNCATE commits, provided it had not already accessed the table beforehand.
- **D.** A newly created table's row contents are exempt from normal snapshot rules in the same way the table's existence is, so concurrent Repeatable Read transactions can see rows inserted into it immediately.
- **E.** A Repeatable Read transaction running on a hot standby can occasionally observe a transient state that would be inconsistent with any serial ordering of the transactions committed on the primary.

<details><summary>Answer</summary>

**A.** **C.** **E.** — Three of these are stated directly in the caveats material: TRUNCATE/table-rewriting ALTER TABLE break MVCC-safety, a snapshot taken before a concurrent TRUNCATE offers no protection once that TRUNCATE commits (the truncation becomes visible to the older snapshot — only a transaction that already accessed the table, and therefore holds a lock blocking the DDL, avoids this), and a standby's Repeatable Read transaction can see a transient state inconsistent with any serial execution on the primary. The claim about explicit catalog queries is backwards — the documentation says such queries do NOT see rows for concurrently created objects at the higher isolation levels; that exemption applies only to internal catalog lookups. Likewise the claim about a new table's contents is backwards — only the object's existence gets the exception; the rows it contains still follow ordinary snapshot visibility.

</details>

### transactions-005

Given that proper use of MVCC generally outperforms locking, why does the documentation say PostgreSQL still offers table- and row-level locking facilities at all?

- **A.** Because MVCC cannot by itself prevent dirty reads at the Read Committed isolation level without supplemental row locking.
- **B.** Because advisory locks depend internally on the table- and row-level locking subsystem in order to function at all.
- **C.** For applications that don't need full isolation and would rather handle a few conflict points explicitly themselves.
- **D.** Because without explicit locks, ordinary SELECT statements could block concurrent UPDATE statements on the same rows.

<details><summary>Answer</summary>

**C.** — The documentation states plainly that these facilities exist for applications that don't generally need full isolation and prefer explicit conflict management, while still noting MVCC alone usually performs better. Dirty reads are impossible at Read Committed regardless of any supplemental locking (PostgreSQL never allows them at any level), advisory locks are independent, application-defined locks rather than a layer built on the table/row lock subsystem, and plain SELECT never blocks a concurrent UPDATE under ordinary MVCC behavior.

</details>

### transactions-006

A session runs SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED expecting to be able to observe another transaction's uncommitted writes. What actually happens?

- **A.** The command is rejected with a syntax error, since READ UNCOMMITTED is not one of the isolation levels PostgreSQL recognizes.
- **B.** The request is accepted, but internally PostgreSQL treats it identically to Read Committed, so dirty reads remain impossible.
- **C.** The session silently gets Serializable behavior instead, since that is the only level PostgreSQL considers "safe enough" to substitute.
- **D.** The request is honored exactly as written, and the session can now see uncommitted data from any other concurrently running transaction.

<details><summary>Answer</summary>

**B.** — PostgreSQL only implements three isolation levels internally, and a request for Read Uncommitted is quietly mapped onto Read Committed behavior — dirty reads stay impossible no matter which of the four standard levels is requested. The keyword itself is accepted without any syntax error, the fallback target is Read Committed rather than Serializable, and the request is not honored as literally written.

</details>

### transactions-007

The SQL standard only requires that Repeatable Read prevent dirty reads and nonrepeatable reads, leaving phantom reads possible. What does the documentation say about PostgreSQL's actual Repeatable Read implementation?

- **A.** PostgreSQL's Repeatable Read is deliberately weakened to allow phantom reads, exactly matching the standard's minimum requirement and nothing more.
- **B.** PostgreSQL's Repeatable Read also prevents serialization anomalies, making it behave identically to Serializable in every respect.
- **C.** PostgreSQL flags this as a bug still awaiting a fix in a future release, since exceeding the standard's requirements is considered a deviation.
- **D.** PostgreSQL's Repeatable Read also prevents phantom reads — a stronger guarantee than the standard requires, and one it explicitly permits.

<details><summary>Answer</summary>

**D.** — The documentation is explicit that PostgreSQL's Repeatable Read blocks every phenomenon in the standard's table except serialization anomalies — including phantom reads, which the standard itself does not require at that level — and calls this acceptable because the standard defines only minimum, not maximum, protections. It is not deliberately weakened to match the bare minimum, serialization anomalies remain possible under Repeatable Read (only Serializable rules those out), and exceeding the standard is treated as an accepted design choice, not a bug.

</details>

### transactions-008

Under Read Committed, an UPDATE's WHERE clause targets a row that a different transaction already modified and committed while the UPDATE was waiting. Per the documentation, what happens once the wait ends?

- **A.** The waiting UPDATE is unconditionally skipped for that row, on the theory that some other transaction already handled it.
- **B.** The waiting transaction is immediately rolled back with a serialization error, the same outcome Repeatable Read would produce in this situation.
- **C.** The WHERE clause is re-evaluated against the row's newly updated version, and if it still matches, the waiting UPDATE proceeds using that version.
- **D.** The waiting UPDATE keeps blocking until every other transaction in the entire session pool has committed or rolled back, not just the one that modified the row.

<details><summary>Answer</summary>

**C.** — Read Committed re-checks the search condition against the row's latest committed version once the blocking transaction finishes, and proceeds against that updated version if it still qualifies (unless the row was deleted, in which case the row is simply ignored). It does not unconditionally skip the row, it does not throw the concurrent-update serialization error that only Repeatable Read produces, and it only waits on the specific transaction holding the conflicting lock, not on every other session.

</details>

### transactions-009

A Repeatable Read transaction tries to UPDATE a row that another transaction already modified and committed after the Repeatable Read transaction's snapshot was taken. What does the documentation say happens?

- **A.** The transaction is rolled back with an error, and the application is expected to retry the entire transaction from the beginning.
- **B.** The update is quietly applied against the newer, already-committed version of the row, the same as it would be under Read Committed.
- **C.** The transaction blocks forever on that row, since Repeatable Read never times out and never raises a concurrent-update error.
- **D.** The exact same outcome can happen to a read-only Repeatable Read transaction that never issues any UPDATE or DELETE itself.

<details><summary>Answer</summary>

**A.** — Repeatable Read waits for the first updater to finish and then, if that updater committed a real change to the row, aborts the waiting transaction with an error reporting that access couldn't be serialized because of the concurrent update, rather than silently applying the change — the application must then retry the whole transaction, which will pick up the already-committed change as part of its fresh initial view. Applying the update against the newer row silently is Read Committed behavior, not Repeatable Read; the wait does end (in an error) rather than hanging forever; and the documentation is explicit that only updating transactions can hit this error, read-only transactions never encounter serialization conflicts.

</details>

### transactions-010

Per the performance guidance for Serializable transactions, why might lowering random_page_cost or raising cpu_tuple_cost reduce the rate of serialization failures?

- **A.** It causes PostgreSQL's predicate-locking mechanism to switch from non-blocking monitoring to ordinary blocking locks, which conflict less often in practice.
- **B.** It turns off predicate locking altogether for any table the planner decides to scan sequentially, removing the monitoring entirely for that table.
- **C.** It automatically converts every Serializable transaction touching that table into a Repeatable Read transaction, which does not monitor for read/write dependencies.
- **D.** It nudges the planner toward index scans over sequential scans, and a sequential scan always needs a relation-level predicate lock, raising failure odds.

<details><summary>Answer</summary>

**D.** — The documentation ties this tuning advice directly to the fact that a sequential scan always necessitates a relation-level (rather than finer-grained) predicate lock, so encouraging index scans via these two cost parameters can reduce serialization-failure rates. Predicate locks never become ordinary blocking locks — they are non-blocking by design regardless of these settings — cost-parameter tuning doesn't disable predicate locking outright, and it has no effect on which isolation level a transaction is actually running under.

</details>

### transactions-011

Which of the following statements about Serializable transactions and replication are accurate per the documentation? *(choose three)*

- **A.** A Serializable transaction run directly on a hot standby server can never see a state inconsistent with a serial execution of the primary's transactions, because Serializable is fully supported there.
- **B.** The integrity protection that Serializable transactions provide hasn't yet been extended to cover either hot standby mode or logical replicas.
- **C.** Performing all permanent writes within Serializable transactions on the primary guarantees that a standby can never show any transient inconsistency, even before it has fully caught up.
- **D.** The strictest isolation level currently supported when connected directly to a hot standby server is Repeatable Read.
- **E.** Applications relying on a hot standby or a logical replica for consistency checks may be better off using Repeatable Read together with explicit locking on the primary instead.

<details><summary>Answer</summary>

**B.** **D.** **E.** — The documentation states directly that Serializable's integrity guarantee doesn't extend to hot standby or logical replicas, that Repeatable Read is the strictest level currently supported when connected to a hot standby, and that Repeatable Read with explicit locking on the primary is the suggested alternative for those relying on standbys or logical replicas. The claim that Serializable is fully supported on a hot standby is false — it cannot even be requested there. The claim about writing everything through Serializable on the primary is also false: the documentation only says this makes standbys "eventually" reach a consistent state, while separately warning that a standby can see a transient state inconsistent with any serial ordering in the meantime.

</details>

### transactions-012

Table-level lock modes such as ROW SHARE and ROW EXCLUSIVE include the word "row" in their names. What does the documentation say about this naming?

- **A.** These modes escalate automatically to true row-level locks once the number of affected rows crosses an internal threshold.
- **B.** Despite "row" in the name, these remain table-level locks; what actually distinguishes them is simply which modes conflict.
- **C.** They share the same underlying lock table used to track FOR UPDATE and FOR SHARE row-level locks.
- **D.** They are reserved names that a session can additionally acquire manually only through the LOCK TABLE command, never automatically.

<details><summary>Answer</summary>

**B.** — The documentation is explicit that all of these are table-level locks regardless of "row" appearing in the mode name, and that the real distinguishing factor across modes is purely the set of other modes each one conflicts with. There is no documented escalation from a table lock to a row-granularity lock, they are tracked separately from the row-level lock table used for FOR UPDATE/FOR SHARE, and several of them (like ROW EXCLUSIVE, acquired automatically by UPDATE/DELETE/INSERT/MERGE) are routinely taken without any explicit LOCK TABLE command.

</details>

### transactions-013

According to the documentation's tip on table-level locks, which single lock mode is capable of blocking a plain SELECT statement that has no FOR UPDATE/FOR SHARE clause?

- **A.** ONLY ACCESS EXCLUSIVE — the mode acquired by commands like DROP TABLE, TRUNCATE, and VACUUM FULL.
- **B.** EXCLUSIVE, because it conflicts with every mode besides ACCESS SHARE, so it necessarily blocks a plain read too.
- **C.** SHARE ROW EXCLUSIVE, because it is self-exclusive and only one session can hold it on a table at a time.
- **D.** ROW EXCLUSIVE, because it is the mode routinely acquired by UPDATE, DELETE, INSERT, and MERGE.

<details><summary>Answer</summary>

**A.** — The documentation's tip states plainly that only an ACCESS EXCLUSIVE lock blocks a plain SELECT. The EXCLUSIVE-mode distractor is actually the opposite of the truth: EXCLUSIVE is explicitly described as allowing concurrent ACCESS SHARE locks, meaning ordinary reads can still proceed alongside it. SHARE ROW EXCLUSIVE conflicts with ROW EXCLUSIVE and several other modes but not with the ACCESS SHARE lock a plain SELECT takes, and ROW EXCLUSIVE (the mode a writer itself takes) likewise leaves ACCESS SHARE unblocked.

</details>

### transactions-014

Per the row-level lock conflict table, which other row-level lock mode does a plain FOR KEY SHARE lock actually conflict with?

- **A.** It conflicts with FOR SHARE and FOR NO KEY UPDATE as well, since both are considered stronger than a plain read.
- **B.** It blocks any concurrent UPDATE or DELETE whatsoever, even one that touches none of the row's key columns.
- **C.** Only FOR UPDATE — a plain FOR KEY SHARE doesn't block FOR SHARE, FOR NO KEY UPDATE, or another FOR KEY SHARE.
- **D.** It is self-conflicting, so a second session requesting FOR KEY SHARE on the same already-locked row must wait.

<details><summary>Answer</summary>

**C.** — The row-level conflict table shows FOR KEY SHARE conflicting with nothing except FOR UPDATE. It does not conflict with FOR SHARE or FOR NO KEY UPDATE, so the claim that it blocks either of those is false; the description text specifically says a key-shared lock blocks DELETE and any key-changing UPDATE (both of which acquire the FOR UPDATE mode) but not other UPDATE commands, so "any concurrent UPDATE or DELETE whatsoever" overstates it; and the table shows no conflict between two FOR KEY SHARE requests, so it is not self-conflicting.

</details>

### transactions-015

What distinguishes a session-level advisory lock from a transaction-level advisory lock, per the documentation?

- **A.** A session-level lock is automatically released the moment the transaction that acquired it commits, exactly like a transaction-level lock.
- **B.** A transaction-level lock also requires the session to explicitly call a matching unlock function before it will ever be released, exactly like a session-level lock does.
- **C.** Both a session-level lock and a transaction-level lock are immediately released as soon as the transaction that acquired them is rolled back.
- **D.** A session-level lock survives a rollback and lasts until unlocked or the session ends; a transaction-level lock releases automatically at transaction end.

<details><summary>Answer</summary>

**D.** — The documentation states that a session-level advisory lock ignores transaction semantics entirely — it persists through a rollback and only goes away via an explicit unlock call or the session ending — whereas a transaction-level lock behaves like an ordinary lock and is released automatically at transaction end. So a session-level lock is not tied to transaction commit, a transaction-level lock has no explicit unlock operation to call, and a rollback does not clear a session-level lock the way it would a transaction-level one.

</details>

### transactions-016

The documentation warns against calling an advisory-lock function directly inside a query whose row set is restricted with ORDER BY and LIMIT. Why is that combination dangerous?

- **A.** PostgreSQL raises a syntax error whenever an advisory-lock function call appears in the same SELECT list as a LIMIT clause.
- **B.** There's no guarantee the LIMIT gets enforced before the lock-acquiring function runs, so extra rows can end up locked and left dangling.
- **C.** The locks taken this way are automatically released the moment the query finishes executing, so no dangling-lock cleanup is ever needed.
- **D.** Wrapping the same advisory-lock call inside an inner subquery that applies the LIMIT before the outer query runs makes no real difference to this hazard.

<details><summary>Answer</summary>

**B.** — The hazard the documentation describes is exactly an evaluation-order problem: there's no guarantee the LIMIT gets enforced ahead of when the locking function actually runs, so more rows than intended can get locked, and those extra locks stay dangling (though still visible in pg_locks) until the session ends. No syntax error is raised for this pattern, the resulting locks are explicitly described as persisting rather than auto-releasing at query end, and pushing the LIMIT into an inner subquery before the lock call is the documented fix, not an ineffective one.

</details>

### transactions-017

Which of the following statements about the pg_locks system view are accurate per the documentation? *(choose three)*

- **A.** Row-level locks normally do not show up as rows in pg_locks, because information about them is tracked on disk rather than kept in memory.
- **B.** pg_blocking_pids() is recommended over self-joining pg_locks against itself to work out which processes are blocking a given waiting process.
- **C.** A relation that nothing is currently holding or waiting on will still show up as a row in pg_locks, just with its granted column set to false.
- **D.** Locktype values such as advisory identify rows in the view that represent application-defined advisory locks rather than locks on relations.
- **E.** When the view is queried, fast-path lock data and the rest of the regular lock manager's data are always captured together as one single atomic snapshot.

<details><summary>Answer</summary>

**A.** **B.** **D.** — The documentation confirms three of these: row-level lock information lives on disk rather than in the in-memory lock table (so it normally doesn't appear as its own pg_locks row), pg_blocking_pids() is recommended precisely because a self-join is hard to get right, and the locktype column includes an advisory value for exactly this kind of lock. The claim about an unlocked object appearing anyway is false — the documentation says such an object won't appear in the view at all. The claim about one single atomic snapshot is also false — fast-path lock data is gathered backend-by-backend without freezing the whole lock manager first, so it is explicitly not captured together with the rest as one atomic action.

</details>

### transactions-018

What is the documented effect of increasing the deadlock_timeout setting?

- **A.** It causes the server to check for a deadlock more frequently while a process is waiting on a lock.
- **B.** It eliminates the possibility of deadlocks occurring once the value is set high enough.
- **C.** It cuts down on needless deadlock checks (since the check is relatively expensive) but slows how quickly a genuine deadlock gets reported.
- **D.** It only changes how long the server waits before logging a lock-wait message under log_lock_waits, with no bearing on the deadlock check itself.

<details><summary>Answer</summary>

**C.** — The documentation frames deadlock_timeout as a trade-off: because the deadlock check itself is relatively expensive, waiting longer before running it avoids needless checks in the common case where no deadlock exists, at the cost of a slower real-deadlock report. Raising the value makes the server check less often, not more; it changes only the timing of detection, not whether deadlocks can occur at all; and it directly gates the deadlock check itself, with the log_lock_waits message timing being a secondary effect that piggybacks on the same setting rather than the only thing it controls.

</details>

### transactions-019

What does the documentation recommend as the best general defense against deadlocks?

- **A.** Have every application lock shared objects in the same consistent order, taking the strongest mode actually needed as the first lock on each.
- **B.** Rely entirely on the automatic deadlock detector and give no thought to the order in which locks are acquired, since PostgreSQL always resolves the situation cleanly.
- **C.** Always request an ACCESS EXCLUSIVE lock first in every transaction, regardless of what that transaction will actually do to the object.
- **D.** Switch every transaction to Serializable isolation, since the predicate locks Serializable relies on can never be part of a deadlock cycle.

<details><summary>Answer</summary>

**A.** — The documentation frames avoidance, not just reactive detection, as the best defense: get all applications to lock shared objects in a consistent order, and take the most restrictive mode actually needed as the first lock on an object. Leaning solely on the detector isn't the recommended posture — it resolves deadlocks by aborting a transaction, which is disruptive, not something to lean on instead of avoidance. Requesting ACCESS EXCLUSIVE unconditionally overshoots the "most restrictive mode actually needed" guidance. And while it's true that Serializable's SIRead predicate locks can never contribute to a deadlock, ordinary row- and table-level locks used within a Serializable transaction still can, so switching isolation levels alone isn't the documented fix.

</details>

### transactions-020

When PostgreSQL detects a deadlock between two transactions, what does the documentation say it does?

- **A.** It always aborts whichever of the two transactions most recently requested the conflicting lock.
- **B.** It queues the newer request indefinitely and waits for a database administrator to intervene manually.
- **C.** It downgrades one of the two transactions' lock requests to a weaker, non-conflicting mode, letting both transactions continue instead of aborting either one.
- **D.** It automatically aborts one of the transactions, letting the other proceed — but which one gets picked is hard to foresee and shouldn't be relied on.

<details><summary>Answer</summary>

**D.** — The documentation says PostgreSQL automatically resolves a detected deadlock by aborting one of the transactions and letting the rest continue, explicitly cautioning that which transaction gets aborted is hard to predict and shouldn't be depended on. There's no rule tying the choice to which lock request came most recently, no manual-intervention requirement, and no lock-downgrading mechanism described as an alternative to aborting a transaction.

</details>

### transactions-021

How does the documentation say an application should treat a unique-key violation (SQLSTATE 23505) compared to a serialization_failure (SQLSTATE 40001)?

- **A.** Both codes should always be retried unconditionally with identical logic, since PostgreSQL provides a built-in automatic-retry facility for each.
- **B.** A 23505 error should never be retried under any circumstance, while a 40001 error should be retried an unlimited number of times with a guarantee of eventual success.
- **C.** A 23505 failure needs more caution before retrying than a 40001 failure does, since it can reflect a persistent conflict, not just a transient one.
- **D.** A 23505 error actually indicates that a deadlock was detected and resolved, while a 40001 error indicates the transaction committed successfully.

<details><summary>Answer</summary>

**C.** — The documentation recommends retrying serialization_failure (40001) unconditionally but says more care is warranted for a unique-key failure (23505), since it can represent a persistent condition rather than a transient one, even though in some corner cases it is genuinely a disguised serialization problem the server had no way to detect as such. There is no automatic-retry facility for either code — the documentation explicitly says PostgreSQL doesn't offer one, and it never promises that a retried transaction is guaranteed to eventually succeed. The claim tying 23505 to deadlocks and 40001 to success is simply a mismatch of what each SQLSTATE code actually means.

</details>

### transactions-022

Which of the following statements about application-level data consistency checks are accurate per the documentation? *(choose three)*

- **A.** SELECT FOR UPDATE guarantees a locked row can never be updated or deleted by any other transaction, even after the transaction that issued the SELECT FOR UPDATE has committed.
- **B.** Enforcing data-integrity business rules is very hard to do with Read Committed transactions, since what a query sees can shift from one statement to the next within the same transaction.
- **C.** Checking a running total by issuing two SELECT sum(...) queries one after another and comparing their results is unreliable in Read Committed mode, since the later query is likely to include commits the earlier one missed.
- **D.** A SHARE mode (or stronger) lock on a table guarantees there are no uncommitted changes in that table from any transaction other than the one holding the lock.
- **E.** A Repeatable Read transaction's snapshot is frozen the instant its BEGIN statement runs, before any explicit LOCK TABLE statement issued afterward could still precede that freeze.

<details><summary>Answer</summary>

**B.** **C.** **D.** — Three of these are stated directly: Read Committed makes business-rule enforcement hard because the visible data shifts statement to statement, comparing successive sum() queries under Read Committed is unreliable for the same reason, and a SHARE-or-stronger table lock does guarantee no uncommitted changes from other transactions remain. The SELECT FOR UPDATE claim is false — once the locking transaction ends, a previously blocked transaction proceeds with its conflicting UPDATE/DELETE unless the row was actually modified while the lock was held, so the lock does not protect the row forever. The snapshot-timing claim is also false — a Repeatable Read transaction's snapshot is frozen at the start of its first non-transaction-control statement (its first real query or data-modifying command), not at BEGIN, which is precisely why an explicit LOCK TABLE issued right after BEGIN can still be obtained before the snapshot is frozen.

</details>

## Administration & Maintenance

24 questions

### administration-001

In PostgreSQL, how does the object created by CREATE USER differ, structurally, from one created by plain CREATE ROLE?

- **A.** There is no structural difference at all — CREATE USER is just CREATE ROLE with the LOGIN attribute defaulting to on instead of off.
- **B.** CREATE USER always requires superuser privileges to run, while CREATE ROLE can be run by any authenticated session with no special privilege.
- **C.** CREATE USER automatically grants membership in every existing role, while CREATE ROLE grants membership in none of them by default.
- **D.** CREATE USER produces a distinct kind of database object that supports login, while CREATE ROLE can never produce an object that logs in.

<details><summary>Answer</summary>

**A.** — PostgreSQL treats users and roles as the same underlying kind of object; the only distinction is that CREATE USER flips the default from NOLOGIN to LOGIN, whereas plain CREATE ROLE defaults to NOLOGIN. The claim that CREATE USER yields some separate, login-capable object type is false — a plain CREATE ROLE can log in too, it just needs LOGIN spelled out explicitly. Neither spelling has a different privilege requirement for who may run it, and neither one grants any role membership automatically just by virtue of which keyword was used.

</details>

### administration-002

Role app_writer is granted membership in role db_admin (which carries the CREATEDB attribute), and that membership grant has the INHERIT option turned on. What happens when app_writer tries to run CREATE DATABASE?

- **A.** It succeeds immediately, because an INHERIT membership automatically propagates every attribute of db_admin, including CREATEDB, to app_writer.
- **B.** It succeeds, but only because CREATEDB happens to be carved out as an exception to the general non-inheritance rule for role attributes.
- **C.** It fails, because role attributes such as CREATEDB are non-inheritable regardless of the INHERIT option.
- **D.** It fails permanently and unconditionally, since a role attribute can never be exercised by anyone other than the exact role it was assigned to.

<details><summary>Answer</summary>

**C.** — The attributes handed out by CREATE ROLE (such as CREATEDB, SUPERUSER, CREATEROLE) do not flow through role membership even when that membership has the INHERIT option enabled — inheriting a role's privileges on its owned objects is a separate thing from inheriting its account-level attributes. To actually exercise db_admin's CREATEDB, app_writer would need the membership's SET option so it can switch into db_admin first. Nothing carves CREATEDB out as a special exception, and the block isn't truly permanent — switching into the role remains a documented workaround.

</details>

### administration-003

Which statement about a role's CONNECTION LIMIT setting is accurate?

- **A.** It is enforced with total precision, so it's impossible for two sessions racing for the last available slot to both slip through.
- **B.** It counts prepared transactions and background worker connections toward the total, in addition to ordinary client connections.
- **C.** The setting is disregarded for superuser roles altogether — no configured limit will ever stop a superuser from connecting.
- **D.** Its default value of zero connections means a freshly created role cannot open any session until an administrator explicitly raises the limit.

<details><summary>Answer</summary>

**C.** — The documentation is explicit that connection-limit enforcement is skipped for superuser roles no matter how the limit is set. It also says the opposite of precise enforcement — the check is only approximate, so two sessions racing for the same last slot can, in fact, both fail. Prepared transactions and background-worker connections are specifically excluded from the count, not included. And the default value is -1 (meaning unlimited), not zero, so an unconfigured role isn't locked out.

</details>

### administration-004

A role is created with CREATE ROLE app WITH LOGIN PASSWORD 'x123', without the ENCRYPTED keyword. What happens to the stored password?

- **A.** It is stored as plain, unencrypted text in the system catalogs, since the ENCRYPTED keyword was never supplied.
- **B.** It ends up encrypted regardless — the password is always stored encrypted, and the ENCRYPTED keyword itself has no real effect on that outcome.
- **C.** The command is rejected outright, because PostgreSQL requires ENCRYPTED to be present any time a password value is supplied.
- **D.** It is protected using whatever scheme the connecting client library happens to negotiate at connection time, independent of any server-side setting.

<details><summary>Answer</summary>

**B.** — PostgreSQL never keeps a role's password in cleartext form on disk; it's scrambled before being written to the catalog no matter whether ENCRYPTED was typed, and that keyword survives in the grammar purely for backwards compatibility rather than doing anything functional. Which scrambling method gets used is governed by the server-side password_encryption parameter, not by anything the client negotiates. Nothing about omitting ENCRYPTED causes the command to fail, and the value is never simply written out in the clear.

</details>

### administration-005

For the role-membership form of GRANT (GRANT role_name TO role_specification), which statements about the ADMIN, INHERIT, and SET options are accurate? *(choose three)*

- **A.** The ADMIN option defaults to FALSE, and without it an ordinary member cannot grant or revoke membership in the role to or from others.
- **B.** If the INHERIT option is left unspecified for a new membership, it defaults to the new member role's own inheritance attribute, rather than to a fixed TRUE or FALSE.
- **C.** The SET option defaults to FALSE, so a freshly created membership grant never lets the member switch into the granted role unless SET TRUE is explicitly requested.
- **D.** A superuser account sits above the ADMIN-option bookkeeping entirely, so it can add or remove any role as a member of any other role no matter how existing grants are configured.
- **E.** A role is considered to hold admin rights on itself automatically, so it can always grant its own membership to other roles without any extra step.

<details><summary>Answer</summary>

**A.** **B.** **D.** — Three claims hold up: ADMIN really does default to FALSE and gates who can extend or revoke membership further; an unspecified INHERIT option really does fall back to the new member's own inheritance attribute rather than a hardcoded value; and superusers really can override any existing ADMIN setting when granting or revoking membership. The SET-option claim is wrong the other way around — SET actually defaults to TRUE, so a fresh membership grant normally does let the member switch roles unless SET was explicitly turned off. And a role does not automatically hold admin rights over itself; that has to be granted like anything else.

</details>

### administration-006

What is true about the pg_read_all_data predefined role?

- **A.** It grants exactly the same effect as the BYPASSRLS role attribute, so row-level security policies never apply to a role holding it.
- **B.** It is itself a member of pg_monitor, giving it access to monitoring views on top of its data-reading capability.
- **C.** It lets the holder read every table, view, and sequence, but it does not bypass row-level security policies.
- **D.** It bundles both read and write access, letting the holder modify any table in the database in addition to reading from it.

<details><summary>Answer</summary>

**C.** — pg_read_all_data is documented as granting read access across every table, view, and sequence, but explicitly not bypassing row-level security — administrators who need that are pointed toward the separate BYPASSRLS attribute instead, showing the two are not equivalent. Write access is handled by a completely separate role (pg_write_all_data), not bundled into this one. And pg_read_all_data isn't described as a member of pg_monitor; that composition runs the other direction, with pg_monitor built out of other roles like pg_read_all_settings and pg_read_all_stats.

</details>

### administration-007

A heavily updated table is vacuumed regularly with plain VACUUM (never VACUUM FULL). What happens to the size of its on-disk file over time?

- **A.** It stays essentially the same size, aside from possibly a few pages trimmed off the very end.
- **B.** It grows without any bound, since plain VACUUM does not reclaim any space whatsoever until a VACUUM FULL eventually runs.
- **C.** It shrinks the very first time VACUUM is run and then stays fixed at that size forever, no matter how much update activity follows.
- **D.** It shrinks every single time VACUUM runs, since VACUUM always writes out a fresh copy of the table with the dead space stripped out.

<details><summary>Answer</summary>

**A.** — Plain VACUUM reclaims dead-row space for reuse within the same table but, apart from an easy case involving fully empty pages at the very end of the file, it does not return that space to the operating system — so the file's on-disk size stays roughly steady rather than shrinking. Rewriting the whole file to remove dead space is what VACUUM FULL does, not the plain form. And plain VACUUM does reclaim space for reuse continually, so neither "grows without bound" nor "only shrinks once and freezes" matches how it actually behaves.

</details>

### administration-008

Will relying purely on the autovacuum daemon ever result in it automatically running VACUUM FULL on a bloated table?

- **A.** No — the daemon runs standard VACUUM often enough that VACUUM FULL shouldn't be needed, and it will never issue VACUUM FULL on its own.
- **B.** Yes, once a table has accumulated more dead tuples than the configured autovacuum_vacuum_max_threshold, the daemon escalates to VACUUM FULL automatically.
- **C.** Yes, but only during whatever low-traffic maintenance window is configured through autovacuum_naptime.
- **D.** Yes, but only for tables that are approaching transaction ID wraparound, where the daemon switches to VACUUM FULL to free space faster.

<details><summary>Answer</summary>

**A.** — The documented goal of autovacuum is to run plain VACUUM frequently enough that a table never needs the disruptive VACUUM FULL treatment, and the daemon is stated outright to never issue VACUUM FULL under any circumstance, including as tables approach the wraparound-prevention age threshold. There is no dead-tuple count, threshold, or naptime-driven maintenance window that causes autovacuum to escalate to VACUUM FULL — that command always has to be run by hand.

</details>

### administration-009

A table has 1,000,000 live tuples, and every autovacuum vacuum-threshold parameter is left at its default. Roughly how many dead tuples need to accumulate before autovacuum will trigger a VACUUM on that table?

- **A.** About 50 dead tuples, since a fixed base count alone determines when autovacuum fires, independent of the table's size.
- **B.** About 200,050 dead tuples, combining the default fixed base amount with 20% of the table's 1,000,000 live tuples.
- **C.** Exactly 1,000,000 dead tuples, since autovacuum by default waits for the table's contents to turn over completely once.
- **D.** About 100,000,000 dead tuples, since that figure is autovacuum's hard ceiling on the trigger threshold no matter how large the table is.

<details><summary>Answer</summary>

**B.** — The vacuum-triggering threshold combines a small fixed base count (50 by default) with a scale factor (20% by default) multiplied by the table's tuple count, so for a million-row table that works out to roughly 50 + 200,000 = 200,050 dead tuples. Using only the fixed base ignores the size-proportional term entirely, waiting for a full turnover of the table overstates what's required, and the 100,000,000 figure is actually the documented ceiling that caps the formula for very large tables — it isn't what triggers vacuuming at this table's size.

</details>

### administration-010

For a table whose entire contents get wiped on a recurring schedule, the documentation favors TRUNCATE over DELETE followed by VACUUM. What is the trade-off being made?

- **A.** TRUNCATE runs more slowly than DELETE plus VACUUM, but in exchange it sidesteps the exclusive lock that DELETE would otherwise require.
- **B.** TRUNCATE clears the table right away without needing a follow-up VACUUM, but it violates strict MVCC semantics.
- **C.** TRUNCATE and a DELETE-then-VACUUM sequence behave identically in every respect, and the documentation expresses no real preference between the two.
- **D.** TRUNCATE still needs a subsequent VACUUM FULL before the freed disk space becomes usable again, unlike DELETE which frees it on the spot.

<details><summary>Answer</summary>

**B.** — TRUNCATE is recommended precisely because it removes all of a table's rows immediately and doesn't leave behind dead row versions that a later VACUUM would need to clean up — the cost of that convenience is that it breaks strict MVCC semantics (concurrent transactions can observe the table as already empty rather than seeing a normal snapshot). The documentation treats the two approaches as clearly different, not equivalent, and it's DELETE that leaves work for VACUUM afterward, not TRUNCATE needing a VACUUM FULL.

</details>

### administration-011

A database has crossed the point where PostgreSQL refuses to assign any new transaction IDs, to avoid wraparound data loss. What is and is not still possible at that point?

- **A.** The entire server stops accepting connections outright, including read-only ones, until it is restarted in single-user mode.
- **B.** VACUUM itself is blocked along with every other command, so the only remaining fix is dropping and recreating the affected tables.
- **C.** Read-only transactions can still run, writes and relation truncation fail, but an ordinary VACUUM command still works to fix the problem.
- **D.** Resolving it safely requires running VACUUM FULL as a superuser, since that command is specifically built to consume the last remaining transaction IDs.

<details><summary>Answer</summary>

**C.** — Once the safety cutoff is reached, transactions already running can finish and new read-only transactions can still start, but anything that would modify records or truncate a relation is refused; a plain VACUUM command keeps working and is the documented way out. The server as a whole doesn't stop accepting all connections, and single-user mode is explicitly not required for this situation in modern PostgreSQL. VACUUM FULL is actually the wrong move here — outside of superuser mode it needs a transaction ID to run and will simply fail, and even as a superuser it consumes a transaction ID and pushes the system closer to wraparound rather than away from it.

</details>

### administration-012

Which statements about the autovacuum daemon's coverage and blind spots are accurate? *(choose three)*

- **A.** Autovacuum schedules ANALYZE purely based on how much a table's statistical distribution has actually shifted, skipping tables whose distribution hasn't meaningfully changed even after heavy row modification.
- **B.** Autovacuum cannot reach temporary tables at all — any vacuuming or analyzing of them has to be done through session-issued SQL commands instead.
- **C.** Autovacuum does not issue ANALYZE for partitioned tables directly, and changes made to a table's child partitions do not trigger an autoanalyze of the parent — its statistics have to be refreshed by hand.
- **D.** Autovacuum treats a partitioned table exactly like any ordinary table for vacuum purposes, since a partitioned table stores its own tuples directly just like a regular one.
- **E.** Autovacuum skips issuing ANALYZE for foreign tables, since it has no way of judging how often analyzing them would actually be worthwhile.

<details><summary>Answer</summary>

**B.** **C.** **E.** — Three of these hold up: session-local temporary tables genuinely sit outside autovacuum's reach and need manual handling; a partitioned table's own row count never actually changes (only its leaf partitions hold data), so the daemon can't and doesn't auto-analyze the parent just because child partitions changed; and foreign tables are skipped for the same reason — the daemon has no visibility into how often their statistics need refreshing. The distribution-based scheduling claim is backwards — autovacuum actually schedules ANALYZE purely by counting how many rows were touched, with no awareness of whether that changed the statistics meaningfully. And a partitioned table can't be treated like an ordinary one for this purpose, since a partitioned table holds no rows of its own at all — only its partitions do.

</details>

### administration-013

An administrator runs plain pg_dump against a single database inside a cluster that also has several custom roles and tablespaces defined. What ends up inside the resulting dump?

- **A.** Only the objects belonging to that one database — pg_dump does not export other databases, roles, or tablespaces.
- **B.** That single database along with the definitions of every role and tablespace in the cluster, since those are treated as part of any single-database dump.
- **C.** Nothing usable — pg_dump refuses to produce output unless it is first pointed at a pg_dumpall-generated file.
- **D.** That single database along with every other database that exists in the same cluster, since pg_dump operates across the whole cluster by default.

<details><summary>Answer</summary>

**A.** — pg_dump is scoped to exactly one database at a time; it neither pulls in the cluster's other databases nor captures objects that live above the database level, such as roles and tablespaces — those require pg_dumpall instead. It does not need a pg_dumpall file as a prerequisite to run, and it never silently expands its scope to the whole cluster on its own.

</details>

### administration-014

Beyond ordinary database contents, what does pg_dumpall capture for a cluster that a plain pg_dump of each individual database in that cluster would miss?

- **A.** Table indexes and constraints, which the documentation says pg_dump omits from its output by default.
- **B.** The contents of the WAL archive directory, since pg_dumpall doubles as a continuous-archiving tool rather than a purely logical dump utility.
- **C.** Query-plan statistics gathered by EXPLAIN ANALYZE runs, which pg_dump is documented as deliberately stripping out.
- **D.** Database roles, tablespaces, and privilege grants that apply to configuration parameters — cluster-wide objects that pg_dump does not save.

<details><summary>Answer</summary>

**D.** — pg_dumpall is explicitly documented as additionally dumping the cluster-wide objects that a per-database pg_dump run leaves out: roles, tablespaces, and the privilege grants attached to configuration parameters. pg_dump actually does include a table's indexes and constraints as part of a normal dump, so that first claim is backwards. pg_dumpall has nothing to do with WAL archiving — logical dumps of either kind are explicitly documented as unusable for that purpose — and neither tool concerns itself with EXPLAIN ANALYZE output at all.

</details>

### administration-015

Which statements about pg_dump's output formats are accurate? *(choose three)*

- **A.** The directory format is the only output format that supports spreading a single dump across multiple worker processes running in parallel.
- **B.** The plain-text script format can only be reloaded using pg_restore — feeding it to psql will not work.
- **C.** The tar format does not support compression, and the relative order in which table data items appear cannot be changed during a restore from a tar archive.
- **D.** Both the custom format and the directory format are compressed by default, unlike the plain-text script format.
- **E.** Directory-format archives cannot be touched with ordinary Unix tools like gzip, since they use a proprietary, opaque container structure.

<details><summary>Answer</summary>

**A.** **C.** **D.** — Three of these match the documentation: the directory format really is the only one that lets multiple worker processes write dump data at the same time; the tar format really is uncompressed and really does lock in the relative ordering of table data at restore time; and the custom and directory formats really are both compressed by default while the plain-text script format is not. The claim about plain-text scripts is backwards, though — those are meant to be fed to psql, not pg_restore. And directory-format archives are explicitly described as ordinary files on disk that standard Unix tools like gzip, lz4, or zstd can operate on directly, not some opaque proprietary container.

</details>

### administration-016

A team wants to use pg_basebackup to back up just one database out of a multi-database cluster, connecting as a role with ordinary login rights only (no REPLICATION attribute, not a superuser). What does the documentation say about this plan?

- **A.** It will work exactly as described — pg_basebackup has always supported picking out a single database for this kind of selective backup.
- **B.** It fails on two counts: pg_basebackup always backs up the entire cluster, and the connecting role needs REPLICATION permission or superuser status.
- **C.** It will succeed for taking the backup, but only a superuser is later permitted to restore output produced by pg_basebackup, regardless of who created it.
- **D.** It fails only because of the missing permission — pg_basebackup does otherwise support backing up a single chosen database.

<details><summary>Answer</summary>

**B.** — Two separate documented facts sink this plan at once: pg_basebackup always operates on the whole cluster and has no mechanism for singling out one database or object (a tool like pg_dump is what's needed for that), and taking any backup at all requires the connecting role to either hold the REPLICATION attribute or be a superuser. There's no special restore-time superuser requirement layered on top of that, and the claim that only the permissions issue is blocking the plan wrongly implies selective single-database backups are otherwise supported.

</details>

### administration-017

During a point-in-time recovery built on continuous WAL archiving, must the replay process work its way through every archived WAL record, all the way to the most recent one?

- **A.** Yes — WAL replay is all-or-nothing, so recovery always lands the database at the exact instant of the newest archived record.
- **B.** No, but stopping the replay early always leaves the database in a corrupted state that has to be repaired with VACUUM FULL before use.
- **C.** Yes, unless the DBA manually edits the archived WAL files ahead of time to delete everything after the desired stopping point.
- **D.** No — replay can be halted at any chosen point, producing a consistent snapshot of the database as of that moment.

<details><summary>Answer</summary>

**D.** — Point-in-time recovery works precisely because replay does not have to run to the end of the archived WAL sequence — stopping it partway still yields a database state that is internally consistent as of that stopping point. There's no requirement to hand-edit archived WAL files to achieve this, and stopping early does not corrupt anything or require a VACUUM FULL cleanup afterward; the replayed state is a valid, ordinary database snapshot.

</details>

### administration-018

Which statements about setting up WAL archiving with archive_command are accurate? *(choose three)*

- **A.** WAL archiving will also restore any manual edits later made to postgresql.conf, pg_hba.conf, or pg_ident.conf, since those files travel along with the WAL stream.
- **B.** In the archive_command string, %p is substituted with the path to the file being archived, and %f is substituted with just the bare file name.
- **C.** A pg_dump or pg_dumpall export can be fed directly into a WAL archiving pipeline, since both produce output detailed enough for WAL replay to consume.
- **D.** A zero exit status from the archive command is treated as success and the segment gets removed or recycled; any nonzero status is treated as a failure that PostgreSQL retries periodically.
- **E.** Setting archive_timeout forces a WAL segment switch once that much time has elapsed, bounding how much unarchived data could be lost — but setting it too short can bloat archive storage.

<details><summary>Answer</summary>

**B.** **D.** **E.** — Three of these are accurate: the %p/%f substitution rule for archive_command is exactly as described; the archive command's exit status genuinely drives success-or-retry behavior the way described; and archive_timeout genuinely trades a smaller potential data-loss window against extra archive storage when set aggressively short. The other two are false: logical exports from pg_dump or pg_dumpall are explicitly documented as unusable for WAL replay, since they don't capture the low-level information continuous archiving depends on, and WAL archiving is explicitly documented as not covering hand-edited configuration files at all, since those changes never go through the WAL stream in the first place.

</details>

### administration-019

A parameter is set to one value in postgresql.conf, and a different value for that same parameter is set through ALTER SYSTEM. Which value takes effect for sessions that connect afterward?

- **A.** The value from postgresql.conf always wins, since an ALTER SYSTEM change only takes effect after the next full server restart, not from a plain configuration reload.
- **B.** The ALTER SYSTEM value wins, because it lands in postgresql.auto.conf, which is read after and overrides postgresql.conf.
- **C.** Neither value applies to anything until a client issues its own explicit SET command naming that parameter within its session.
- **D.** It's left undefined which one wins — the server logs a conflict warning and refuses to start until the duplicate setting is manually removed.

<details><summary>Answer</summary>

**B.** — ALTER SYSTEM changes are written into postgresql.auto.conf, and that file is documented as being read after postgresql.conf with its settings overriding anything postgresql.conf specifies — so the ALTER SYSTEM value is the one new sessions pick up. It doesn't require a full restart to take hold, only the same reload mechanism postgresql.conf itself uses; a session-level SET is not required for the change to apply at connection time; and there's no described conflict-detection mechanism that would block server startup over this.

</details>

### administration-020

After hand-editing postgresql.conf to change a parameter that is documented as reloadable (not fixed at server start), what does it take for the new value to actually apply?

- **A.** Nothing further — PostgreSQL continuously polls postgresql.conf in the background and applies any detected change within a few milliseconds automatically.
- **B.** Every already-open client connection has to be manually dropped and reopened, since a reload signal is documented as affecting only brand-new connections.
- **C.** The change can only be applied through the ALTER SYSTEM command instead — direct hand-edits to postgresql.conf are ignored entirely once the server is running.
- **D.** The server process needs to receive a SIGHUP signal (via pg_ctl reload or pg_reload_conf()), which it also propagates to already-connected sessions.

<details><summary>Answer</summary>

**D.** — The configuration file is only reread when the server process gets a SIGHUP signal, most conveniently sent through pg_ctl reload or the pg_reload_conf() SQL function, and that signal is passed along to already-connected sessions as well so they pick up the new value too. There's no continuous background polling that applies changes automatically, existing sessions do adopt the new value rather than being left stuck on the old one, and hand-editing postgresql.conf is very much still a valid way to change reloadable settings — ALTER SYSTEM is an alternative to that, not a replacement requirement.

</details>

### administration-021

An extension's control file sets trusted = true, while leaving the default superuser = true also in effect. What happens when a non-superuser role — one that only holds CREATE privilege on the current database — runs CREATE EXTENSION for it?

- **A.** The command is rejected outright, since a trusted flag only relaxes requirements for ALTER EXTENSION later on, never for the initial CREATE EXTENSION.
- **B.** Installation is allowed, but the calling user's whole session gets permanently promoted to superuser status for the remainder of that session.
- **C.** Installation is allowed only if the calling user also happens to hold a predefined role whose name matches the extension being installed.
- **D.** Installation is allowed, and the install script runs as the bootstrap superuser rather than as the calling user.

<details><summary>Answer</summary>

**D.** — Marking an extension trusted is specifically what lets a non-superuser with database-level CREATE privilege install it despite the extension's script needing superuser-level operations — the script itself is executed as the bootstrap superuser rather than as the calling user, while the calling user still becomes the owner of the extension object for future privilege checks. There's no session-wide promotion to superuser involved, and nothing ties eligibility to holding some matching predefined role. The trusted flag governs the initial CREATE EXTENSION itself, not just later updates.

</details>

### administration-022

A database has the hstore extension installed, which created a batch of functions and operators as part of loading it. When pg_dump exports that database, what happens to those extension-created objects?

- **A.** pg_dump writes out a separate CREATE statement for every individual function and operator the extension created, exactly as if they weren't grouped into an extension at all.
- **B.** pg_dump skips the extension altogether, so restoring the dump leaves the resulting database without hstore or anything it created.
- **C.** pg_dump converts each extension-created object into an equivalent built-in construct, so the restored database no longer needs the extension installed at all.
- **D.** pg_dump does not dump the extension's individual member objects; it just emits a CREATE EXTENSION command instead.

<details><summary>Answer</summary>

**D.** — pg_dump is documented as understanding that an extension's member objects belong together, so instead of dumping each function or operator individually it just emits a CREATE EXTENSION command and relies on that extension's own installation script to rebuild everything when the dump is restored. The extension is not skipped or silently dropped from the dump, and its objects are not converted into some extension-independent built-in equivalent — restoring the dump still depends on the extension's files being available.

</details>

### administration-023

A DBA wants to add a new partition to a large, busy partitioned table with as little disruption as possible. Comparing CREATE TABLE ... PARTITION OF against building the table separately first and then running ALTER TABLE ... ATTACH PARTITION, what is the documented locking difference?

- **A.** ATTACH PARTITION only needs a weaker SHARE UPDATE EXCLUSIVE hold on the parent, while CREATE TABLE ... PARTITION OF takes the far more disruptive ACCESS EXCLUSIVE lock.
- **B.** Both approaches take the identical ACCESS EXCLUSIVE lock on the partitioned table, for the same duration, with no meaningful difference between them.
- **C.** CREATE TABLE ... PARTITION OF needs only a SHARE UPDATE EXCLUSIVE lock, while ATTACH PARTITION needs the much stronger ACCESS EXCLUSIVE lock, making CREATE TABLE ... PARTITION OF the friendlier option.
- **D.** Neither approach takes a lock any stronger than ACCESS SHARE, because partition-structure changes were made fully lock-free in current PostgreSQL versions.

<details><summary>Answer</summary>

**A.** — Building the new table separately and attaching it afterward is the more concurrency-friendly path precisely because ATTACH PARTITION only needs a SHARE UPDATE EXCLUSIVE lock on the parent, in contrast to the ACCESS EXCLUSIVE lock that CREATE TABLE ... PARTITION OF requires. The option that reverses which command needs the stronger lock has the relationship exactly backwards. Neither approach avoids locking altogether — ACCESS EXCLUSIVE and SHARE UPDATE EXCLUSIVE are both well above ACCESS SHARE — and the two approaches are not equivalent in their locking cost.

</details>

### administration-024

Which statements about partition pruning are accurate? *(choose three)*

- **A.** What makes pruning possible is purely the bounds baked into each partition's own definition — whether an index happens to exist on the partition key columns plays no role in the decision.
- **B.** Partition pruning requires a CHECK constraint to be manually written on every partition describing its bounds, since PostgreSQL cannot infer that from the partition definition on its own.
- **C.** Unlike constraint exclusion, which only ever runs at query-planning time, partition pruning can also remove partitions during actual query execution, using values that are only known once execution is underway.
- **D.** The default setting for constraint_exclusion is on, so the planner examines CHECK constraints for every query, whether or not the query touches a partitioned or inherited table.
- **E.** Partition pruning can be turned off entirely through the enable_partition_pruning configuration setting.

<details><summary>Answer</summary>

**A.** **C.** **E.** — Three of these hold up: partition pruning really does rely purely on the bounds baked into each partition's definition rather than on indexes, which is why an index on the partition key isn't required for pruning to work; pruning really can happen during query execution as well as during planning, which is exactly the capability that sets it apart from constraint exclusion; and enable_partition_pruning really is documented as the switch that can disable the whole mechanism. The other two are wrong: partition boundary constraints are generated automatically rather than needing to be hand-written, and the documented default for constraint_exclusion is the intermediate 'partition' setting, not 'on' — 'on' would make the planner examine CHECK constraints even for queries that have nothing to do with partitioning.

</details>

## Replication & High Availability

14 questions

### replication-001

PostgreSQL's built-in streaming replication is left at its default settings. If the primary crashes an instant after a client receives a commit acknowledgment, what can happen to that transaction on the standby?

- **A.** Nothing is ever at risk, because the primary is documented as always waiting for the standby before acknowledging any commit by default.
- **B.** The transaction is guaranteed to survive, since streaming replication only ever ships WAL files that are already a full segment (16MB) in size.
- **C.** It can be lost, because streaming replication is asynchronous by default and the WAL for that commit may not have reached the standby yet.
- **D.** It can be lost, but only if the cluster was configured to use file-based log shipping instead of streaming replication in the first place.

<details><summary>Answer</summary>

**C.** — Streaming replication ships WAL continuously but does not, by default, make the primary wait for standby confirmation before reporting a commit as successful, so a small window of unreplicated data always exists unless synchronous replication is explicitly configured. The option claiming the primary always waits by default has the default backwards, the 16MB-segment claim describes file-based log shipping rather than streaming replication (which sends records as they are generated, not by whole files), and restricting the risk to file-based shipping ignores that streaming replication carries the same asynchronous exposure, just with a much shorter window.

</details>

### replication-002

Compared to relying only on a large wal_keep_size setting, what advantage does configuring a replication slot for a standby give the primary?

- **A.** The slot keeps only the WAL segments the standby still needs, avoiding the excess a fixed wal_keep_size tends to retain.
- **B.** The slot removes any possibility that pg_wal could ever grow large, since slots are documented as being exempt from disk space limits.
- **C.** The slot is required before a standby can use streaming replication at all; wal_keep_size only supports file-based log shipping.
- **D.** The slot lets the standby skip taking a fresh base backup entirely, no matter how far behind it has fallen or how long it stayed disconnected.

<details><summary>Answer</summary>

**A.** — A replication slot tracks precisely which WAL a connected consumer still needs, so the primary retains only that much — a fixed wal_keep_size, by contrast, commonly ends up retaining more segments than are actually required. Slots are not exempt from disk pressure (an inactive slot can still cause pg_wal to fill up, which is why max_slot_wal_keep_size exists), slots are not a prerequisite for streaming replication (wal_keep_size alone can support it too), and a standby that has fallen too far behind for its needed WAL to still exist can still require a fresh base backup regardless of slot usage.

</details>

### replication-003

A primary's synchronous_commit is changed from its default of on to remote_write for a synchronous standby. What durability guarantee actually changes?

- **A.** None — on and remote_write are documented as producing identical durability, differing only in how the standby state is labeled in pg_stat_replication.
- **B.** A commit now waits only until the standby's OS has the WAL handed to it, not until that data reaches the standby's own durable storage.
- **C.** remote_write becomes strictly stronger than on, because it additionally waits for the standby to replay the transaction before the primary is released.
- **D.** The primary itself stops flushing its own WAL to disk at commit time, since remote_write shifts that responsibility entirely onto the standby.

<details><summary>Answer</summary>

**B.** — remote_write weakens the guarantee relative to on: a commit only waits until the standby has taken delivery of the WAL and handed it off to its host OS for writing, not until that write actually lands on durable storage there, so an OS-level crash on the standby could still lose the data even though a PostgreSQL-level crash there would not. The claim that remote_write is stronger than on has confused it with remote_apply, which waits for replay and visibility rather than just an OS-level write; the claim that the two settings are functionally identical, differing only in monitoring labels, is also wrong — they genuinely differ in what a commit waits for; and the primary's own WAL flush at commit is unaffected by what durability level is requested from the standby.

</details>

### replication-004

Which of the following statements about streaming and cascading replication are accurate? *(choose two)*

- **A.** A cascading standby forwards only the WAL it streamed directly from its upstream server; anything it restored from an archive is never relayed further downstream.
- **B.** A replication slot name may be made up of lower-case letters, digits, and the underscore character.
- **C.** After switching a log-shipping standby over to streaming replication, archive_timeout still needs to be set to just a few seconds to keep the data-loss window small.
- **D.** Comparing the primary's current WAL write position against the last WAL position the standby has received is one documented way to gauge replication lag.
- **E.** A cascading standby's link to its downstream servers can be configured as synchronous on its own terms, independent of the primary's synchronous_standby_names setting.

<details><summary>Answer</summary>

**B.** **D.** — Two of these hold up: replication slot names really are restricted to lower-case letters, numbers, and underscores, and gauging lag by comparing the primary's current WAL write position with what the standby reports as received is exactly the documented monitoring approach. The other three are wrong: a cascading standby actually relays WAL it obtained from an archive too, not just WAL it streamed directly, so downstream servers are not cut off from archive-sourced records; once streaming replication is active there is no need to keep archive_timeout low, since streaming already closes the data-loss window without it; and cascading replication is currently asynchronous only, with the primary's synchronous-standby configuration having no effect on it at all, so a cascading link cannot be made synchronous independently.

</details>

### replication-005

How does PostgreSQL's built-in logical replication construct the stream of changes it sends to a subscriber, and how does that differ from physical streaming replication?

- **A.** It polls each subscribed table on a fixed interval to diff its current contents against the last snapshot, entirely independent of WAL.
- **B.** It reuses the exact same block-addressed WAL stream that physical replication sends, only relabeling it as logical once it reaches the subscriber.
- **C.** It requires the publisher and subscriber to run identical major PostgreSQL versions, a restriction that plain physical streaming replication does not share.
- **D.** It decodes the WAL into row-level changes keyed to each table's replica identity, instead of shipping raw block-addressed WAL.

<details><summary>Answer</summary>

**D.** — Logical replication decodes the same underlying WAL that physical replication uses, but turns it into a stream of row-level insert/update/delete changes rather than shipping the raw block-addressed records physical replication sends for byte-for-byte reconstruction. It does not work by periodically diffing table contents — it is still WAL-driven — and it does not simply relabel the physical WAL stream. The cross-version claim is backwards: replicating between different major PostgreSQL releases is one of logical replication's documented use cases, while physical log shipping across different major release levels is the one that is not supported.

</details>

### replication-006

A published table has neither a primary key nor any unique index that could serve as its replica identity, but the publication is meant to replicate UPDATE and DELETE operations against it. What must be done?

- **A.** The publisher must set the replica identity to FULL, so the entire row is used to locate the matching row on the subscriber.
- **B.** Nothing — logical replication automatically falls back to matching rows on the subscriber by their physical on-disk location.
- **C.** UPDATE and DELETE statements against that table are silently omitted from the replication stream, with no error raised on either side.
- **D.** The table must be dropped and recreated with a generated surrogate key, since replica identity FULL is no longer offered in current releases.

<details><summary>Answer</summary>

**A.** — When no primary key or suitable unique index exists, setting replica identity FULL is the documented fallback: the entire row is treated as the key for locating the matching row on the subscriber (though that search can be inefficient without a supporting index there). Matching by on-disk physical location isn't how it works — a subscriber is a separate database with no shared physical layout — and attempting UPDATE or DELETE against a table whose replica identity can't support them produces an error on the publisher rather than silently skipping those changes. Replica identity FULL is a real, current option, not something that forces a schema redesign.

</details>

### replication-007

A column is added to a table on a logical replication publisher after its subscription is already running, and the subscriber's copy of that table is not updated to match. What happens?

- **A.** The subscriber inspects the incoming WAL stream, infers the new column definition, and applies an equivalent ALTER TABLE before replaying the change.
- **B.** Nothing on the subscriber's side matters: whatever the publisher sends will apply cleanly regardless of the subscriber table's own column definitions.
- **C.** The DDL itself isn't replicated, and once incoming rows stop fitting the subscriber's table shape, replication for that table starts erroring.
- **D.** The entire cluster of subscribers is automatically paused until every one of them is manually confirmed to have an identical schema to the publisher.

<details><summary>Answer</summary>

**C.** — Schema and DDL changes are outside what logical replication carries — administrators are expected to apply matching changes to the subscriber by hand, and once replicated rows stop fitting the subscriber's existing table shape, replication for that table begins failing with errors until the schema catches up. There's no automatic inference of an ALTER TABLE from the WAL stream, and the subscriber's own table structure very much does matter for whether incoming data will apply cleanly. Nor is there any cluster-wide pause-and-confirm mechanism — each subscription simply keeps applying changes (or erroring) independently of the others.

</details>

### replication-008

Which of the following are accurate statements about what PostgreSQL's built-in logical replication does and does not carry over to a subscriber? *(choose three)*

- **A.** The numeric value a sequence has reached on the publisher isn't kept in sync by logical replication, even though the data already generated from it in a serial or identity column is replicated.
- **B.** A TRUNCATE issued on the publisher is never propagated to a subscriber, no matter how the publication or subscription is configured.
- **C.** A view cannot itself be the direct target of a publication; only ordinary tables, including partitioned ones, can be replicated this way.
- **D.** A subscriber-side table must declare its columns in the same left-to-right order as the publisher's table, or replication for that table fails.
- **E.** Large objects can be logically replicated as long as the table referencing them has a replica identity configured.
- **F.** Renaming the subscriber's copy of a replicated table so its name no longer matches the publisher's breaks replication for that table, since tables are paired by fully qualified name.

<details><summary>Answer</summary>

**A.** **C.** **F.** — Three of these are documented accurately: a sequence's own counter value is not replicated even though data already produced from it and stored in a column is; only regular tables and partitioned tables can be the target of a publication, with views excluded; and because publisher and subscriber tables are paired by fully qualified name, renaming the subscriber's copy breaks that pairing. The other three are wrong: TRUNCATE actually is supported for replication (subject to some foreign-key caveats across subscription boundaries), the subscriber's column order is explicitly allowed to differ from the publisher's, and large objects have no logical-replication workaround at all — a replica identity on the referencing table doesn't change that.

</details>

### replication-009

A PostgreSQL primary server stops responding. What does core PostgreSQL itself do to detect that failure and promote a standby in its place?

- **A.** It opens a dedicated witness connection from the postmaster to the nearest standby and instructs that standby to promote before the primary process exits.
- **B.** Nothing — core PostgreSQL includes no software for detecting a primary failure or triggering a promotion; that coordination is left to separate tooling.
- **C.** Any standby named first in synchronous_standby_names automatically calls pg_promote() on itself once wal_sender_timeout has elapsed with no heartbeat.
- **D.** max_wal_senders dropping to zero active connections is treated by every connected standby as an automatic signal to run pg_ctl promote.

<details><summary>Answer</summary>

**B.** — PostgreSQL is explicit that it ships no built-in mechanism to detect that a primary has failed or to notify a standby that it should take over — administrators are expected to bring in separate tooling (such as a heartbeat-based cluster manager) to handle that detection and to trigger promotion via pg_ctl promote or pg_promote() themselves. There is no witness-connection feature on the postmaster, no self-promotion tied to a standby's position in synchronous_standby_names, and no automatic promotion triggered merely by max_wal_senders reaching zero — all three describe automated failover behavior the documentation says core PostgreSQL does not provide.

</details>

### replication-010

After a standby is promoted to take over for a failed primary, and before a fresh standby has been created to replace it, what is this single-server situation called, and what risk does it create if the old primary later comes back online unmodified?

- **A.** It's called catchup mode, and the risk is that the newly promoted server will refuse read-only queries until the old primary is formally decommissioned.
- **B.** It's called split-brain mode, and the risk is limited to the two servers contending over the same shared disk array, a concern specific to shared-disk failover setups.
- **C.** It's called quorum-loss mode, and the risk only arises when synchronous_standby_names uses the quorum-based ANY method rather than a priority-based list.
- **D.** It's called a degenerate state; the risk is both servers ending up believing they are primary at once, which STONITH-style safeguards guard against.

<details><summary>Answer</summary>

**D.** — This single-server state is called a degenerate state, and the real danger is the old primary rejoining without being told its role has changed, leaving two servers that each believe they are the primary — the kind of split-brain confusion that STONITH-style safeguards (forcibly taking the old primary offline) exist to prevent. Catchup mode is a real term, but it describes a standby still synchronizing after it first attaches, not this post-failover state, and it doesn't involve refusing read queries. Framing the risk as purely a shared-disk contention issue mislabels a concern that applies well beyond shared-disk configurations, and there is no documented 'quorum-loss mode' tied only to the ANY method.

</details>

### replication-011

A standby server is continuously replaying WAL from the primary, but hot_standby is off, so no client can run a query against it. What is this configuration correctly called, and what change would let it also serve read-only queries?

- **A.** This is a warm standby; turning hot_standby on so the standby accepts read-only connections while still replaying WAL is what makes it a hot standby.
- **B.** This is already a hot standby; the hot_standby parameter only affects how quickly it can be promoted, not whether client queries are permitted.
- **C.** This is a cold standby, and read access requires restoring it fresh from an archived base backup rather than changing any running parameter.
- **D.** This configuration can never be queried under any setting, since read access to a replaying standby was removed in favor of logical replication subscribers.

<details><summary>Answer</summary>

**A.** — A standby that is applying WAL but cannot yet be queried is what the documentation calls a warm standby; it becomes a hot standby, informally usable as a read replica, once hot_standby is on and it starts accepting read-only connections while replay continues. Calling it a hot standby already gets the parameter's role backwards — hot_standby is precisely what gates read-only query access, not promotion speed. A cold standby describes a much more static setup than a server continuously replaying WAL, and read-only querying of a replaying standby is exactly the documented hot standby capability, not something removed from PostgreSQL.

</details>

### replication-012

Which of the following is NOT something built into core PostgreSQL, and is instead typically added through a separate third-party layer sitting in front of it?

- **A.** A replication slot that retains WAL for a standby that is still connected and catching up.
- **B.** pg_ctl promote, the documented command that ends standby mode and switches a standby server over into ordinary read/write operation.
- **C.** A connection pooler that multiplexes many client connections onto a smaller set of server-side database connections.
- **D.** Cascading replication, in which a standby relays WAL onward to further downstream standbys.

<details><summary>Answer</summary>

**C.** — Connection pooling, like automatic failover detection, is explicitly left to external software (PgBouncer being the best-known example) rather than shipped inside core PostgreSQL. The other three are all documented native capabilities: replication slots for retaining WAL a standby still needs, pg_ctl promote for ending standby mode, and cascading replication for relaying WAL through an intermediate standby are each part of the built-in replication feature set, not add-ons.

</details>

### replication-013

PgBouncer's pool_mode is changed from the session default to transaction. What changes about how a server-side PostgreSQL connection gets shared among clients?

- **A.** The server connection is now released back to the pool after every single query, whether or not the query sits inside a transaction.
- **B.** A server connection returns to the pool the moment each transaction finishes, letting another client reuse it, rather than it being held for one client's whole session.
- **C.** Nothing changes about connection sharing; pool_mode only controls how PgBouncer authenticates clients on its own listening port.
- **D.** Multi-statement transactions must now be disabled entirely, since only a single statement is permitted per pooled server connection under this mode.

<details><summary>Answer</summary>

**B.** — Transaction pool_mode releases the server-side connection back to the pool the moment a transaction completes, rather than holding it for one client for the full lifetime of its session the way session mode does — so a different client's next transaction can pick up that same server connection right away. Releasing on every individual query, regardless of transaction boundaries, describes statement mode instead. pool_mode governs exactly this server-connection-sharing behavior, not client authentication. And the restriction against multi-statement transactions belongs to statement mode, per the documentation — transaction mode still allows a transaction made up of several statements.

</details>

### replication-014

Which of the following statements about running read-only queries against a hot standby are accurate? *(choose two)*

- **A.** Turning on hot_standby_feedback removes every possible reason a query could be canceled on the standby, not just cleanup-related conflicts.
- **B.** Once a standby query has been blocking WAL replay for longer than max_standby_streaming_delay allows, the standby always terminates that client's entire session rather than just canceling the one statement.
- **C.** Because hot standby connections are read-only, they are free to use LISTEN and NOTIFY the same way an ordinary read-only transaction on the primary can.
- **D.** A hot standby session cannot create a temporary table for its own private use, even though doing so would seem to affect only that one session.
- **E.** Autovacuum keeps running against a hot standby exactly as it does on the primary, since read-only queries still leave dead row versions behind.
- **F.** A hot standby session is rejected if it tries to run SELECT ... FOR UPDATE, because taking that row lock would require modifying the underlying data file.

<details><summary>Answer</summary>

**D.** **F.** — Two of these check out: a hot standby session is barred from creating even a private temporary table, because doing so would still require assigning a transaction ID and updating catalog structures that recovery does not permit; and SELECT ... FOR UPDATE is rejected outright, since taking a row lock would mean writing to the underlying data file. The rest are wrong: hot_standby_feedback only heads off cleanup-related cancellations caused by vacuum removing rows a standby query still needs — it doesn't touch other cancellation causes such as a conflicting Access Exclusive lock; exceeding the standby delay settings normally just cancels the offending statement, with full session termination reserved for specific cases like a DROP DATABASE conflict; hot standby sessions are actually more restricted than ordinary read-only transactions and cannot use LISTEN or NOTIFY at all; and autovacuum is inactive throughout recovery, only resuming once the standby reaches the end of recovery.

</details>
