// js/data/studyContent.js
// Study notes for the Architecture & Data Types domain (15% exam weight).
// Grounded in the official PostgreSQL 18 documentation (docs cached under
// .cache/aws-docs/ during authoring); written in original prose, not copied.
export const STUDY_CONTENT = [
  {
    domain: 'architecture',
    taskStatement: 'Server Architecture & Process Model',
    topics: [
      {
        title: 'Client/Server Model and the Postmaster',
        body: "PostgreSQL runs as a client/server system: a supervisor program called postgres listens for incoming connections, while a separate frontend application — anything from psql to a web app's connection pool — initiates each database session. When a new client connects, the supervisor forks a dedicated backend process to handle that one connection; from then on the client talks directly to its own backend, and the supervisor goes back to waiting for the next request. Because each session gets its own OS process rather than a thread inside a shared process, a crash in one backend generally cannot corrupt another session's memory, though it can still hold locks that affect other sessions indirectly.",
      },
      {
        title: 'The Path of a Query',
        body: "Once a backend receives a SQL command as text, it moves through a pipeline before results come back to the client. A parser stage checks the grammar and builds an internal query tree, PostgreSQL's rule system can then rewrite that tree (for example, expanding a view reference into its underlying query), and the planner evaluates alternative execution strategies — different join orders, different access paths — before picking the one it estimates is cheapest. The executor then walks the chosen plan, pulling rows through each step until the result set is ready. This parse-rewrite-plan-execute sequence is why a badly estimated row count during planning can produce a slow plan even when the SQL itself is perfectly correct.",
      },
      {
        title: 'Write-Ahead Logging as the Durability Backbone',
        body: 'PostgreSQL guarantees durability through write-ahead logging: a record describing a change to a table or index page must be flushed to the WAL before that page itself is allowed to reach disk. This ordering means the server only has to fsync the sequentially written WAL on commit rather than force every modified data page to disk, which is far cheaper. If the server crashes, recovery replays WAL records forward from the last checkpoint, redoing changes that were logged but never made it into the data files — a mechanism often called roll-forward or REDO recovery. That same WAL stream also underpins point-in-time recovery and, as covered under replication, streaming replication to standby servers.',
      },
      {
        title: 'Shared Buffers and Work Mem',
        body: "shared_buffers sizes the block of shared memory every backend uses as a cache for table and index pages, so repeated access to the same data can be served from RAM instead of hitting the filesystem; a commonly cited starting point is roughly a quarter of system memory on a dedicated server, since PostgreSQL still relies heavily on the operating system's own page cache rather than trying to cache everything itself. work_mem, by contrast, is a per-operation budget rather than a per-connection one — it caps how much memory a single sort or hash step can use before spilling to temporary files, and because a complex query can run several such operations at once, and many sessions can run concurrently, total memory use across the server can end up being a large multiple of the configured value.",
      },
      {
        title: 'max_connections and Backend Overhead',
        body: 'max_connections caps how many sessions the server accepts at once, and because each session is a full backend process rather than a lightweight thread, raising this setting increases the baseline memory the server reserves for shared structures even before any session runs a query. This is one reason production deployments often sit an external connection pooler in front of PostgreSQL instead of letting every application thread hold its own long-lived connection — spinning up and tearing down backend processes at high connection counts is not free. A small number of connection slots can also be set aside for superusers, so an administrator can still log in to diagnose a server that has run out of ordinary slots.',
      },
    ],
  },
  {
    domain: 'architecture',
    taskStatement: 'Physical Storage & TOAST Internals',
    topics: [
      {
        title: 'The PGDATA Directory Layout',
        body: "A PostgreSQL cluster keeps its data and configuration under one root directory, conventionally called PGDATA. Inside it, base/ holds one subdirectory per database named after that database's OID, pg_wal/ holds the write-ahead log segments, and pg_tblspc/ holds symbolic links to any tablespaces defined outside PGDATA, while the built-in pg_default and pg_global tablespaces map directly to base/ and global/ without going through a symlink at all. Each ordinary table or index lives in its own file named after a filenode number recorded in pg_class rather than the object's OID, since operations like TRUNCATE or CLUSTER can assign a new filenode while the table's OID stays fixed.",
      },
      {
        title: 'Segment Splitting and Tablespaces',
        body: 'A table or index file cannot grow without limit: once it exceeds roughly one gigabyte, PostgreSQL rolls over to a new segment file, keeping the plain filenode name for the first segment and appending .1, .2, and so on for each additional chunk. That default segment size mainly exists to avoid old operating-system limits on individual file sizes rather than reflecting any deep architectural constraint. Tablespaces let an administrator place particular databases or tables on a different disk or filesystem entirely, which is useful for spreading I/O load across storage devices or separating fast and slow media.',
      },
      {
        title: 'The 8kB Page and Its Header',
        body: "Tables and indexes are both organized as arrays of fixed-size pages, 8kB being the usual default, and a single row is never allowed to span more than one page. Every page opens with a compact header recording, among other things, offsets that mark the boundary between allocated and free space, plus a pointer to the most recent WAL record affecting that page. After the header comes a growing list of small, fixed-size item pointers — essentially (offset, length) references to the actual rows — allocated from the front of the free area, while row data itself is packed in from the back; keeping a pointer's slot stable even while the row underneath it moves around during page compaction is what lets index entries keep referencing it reliably.",
      },
      {
        title: 'Heap Tuple Headers and Visibility',
        body: "Every stored row carries a fixed-size header ahead of its actual column values. Two fields in that header record the identifiers of the transaction that inserted the row and, if applicable, the one that deleted it, and another field can point to a newer version of the same logical row — this is the raw material PostgreSQL's MVCC machinery uses to decide which row versions a given transaction is allowed to see (a mechanism covered in depth in the transactions domain). Because columns can be variable-length, an optional bitmap tracking which columns are null sits between the fixed header and the actual data, and is only present at all when the row has at least one null column.",
      },
      {
        title: 'Why TOAST Exists',
        body: "Since a row can never span more than one page, PostgreSQL needs a separate mechanism for column values that might be far larger than a page allows — long text, big binary blobs, and so on. TOAST solves this by compressing and/or slicing an oversized value into pieces that get stored as rows in a side table linked to the original one, leaving only a small pointer in the main row instead of the full value. Only data types with a variable-length representation qualify, since the technique works by reinterpreting the leading length marker of that representation; once a row's total width crosses roughly 2kB, PostgreSQL keeps compressing or relocating its fields out-of-line until the row fits comfortably again or there's nothing left to shrink.",
      },
      {
        title: 'The Four TOAST Storage Strategies',
        body: 'Every TOAST-able column is assigned one of four storage strategies, which an owner can override later. PLAIN blocks both compression and out-of-line storage and is the only option for columns whose type cannot be TOASTed at all; MAIN permits compression but treats moving data out-of-line as a last resort; EXTENDED, the default for most TOAST-able types, allows both and tries compression first before falling back to out-of-line storage; and EXTERNAL permits out-of-line storage but disables compression, which speeds up substring operations on wide text or byte-array columns because a small slice of an uncompressed out-of-line value can be fetched without decompressing the whole thing first.',
      },
    ],
  },
  {
    domain: 'architecture',
    taskStatement: 'Core Scalar & Temporal Data Types',
    topics: [
      {
        title: 'Integer Types and Their Ranges',
        body: "PostgreSQL offers three whole-number types that differ only in storage width and range: smallint at 2 bytes (roughly plus or minus 32 thousand), integer at 4 bytes (roughly plus or minus 2.1 billion), and bigint at 8 bytes for a vastly larger range. integer is the default workhorse for most columns because it balances range, storage cost, and arithmetic speed; smallint is worth reaching for only when disk space is genuinely tight, and bigint suits counters or identifiers that could plausibly exceed the integer ceiling over a table's lifetime. Trying to store a value outside a column's declared range raises an error rather than silently wrapping or truncating.",
      },
      {
        title: 'numeric for Exact Arithmetic',
        body: "The numeric type stores numbers as exact values with a configurable precision (total significant digits) and scale (digits after the decimal point), which is why it's the recommended choice for money and other quantities where rounding error is unacceptable — its arithmetic is exact wherever that's mathematically possible, though noticeably slower than integer or floating-point math. Leaving off both precision and scale produces an unconstrained numeric column that can hold values of essentially any size up to the implementation limit, without forcing them to a fixed number of decimal places the way an explicitly scaled column would. numeric also supports Infinity, -Infinity, and NaN as special values, and unusually treats NaN as equal to itself and greater than every ordinary value, so numeric columns stay sortable and indexable.",
      },
      {
        title: 'Floating-Point Imprecision',
        body: 'real (4 bytes) and double precision (8 bytes) are IEEE-754 binary floating-point types, meaning most decimal fractions are stored as approximations rather than exact values — a number that looks simple in decimal may not survive a round trip through storage bit-for-bit unchanged. That makes them a poor match for anything where exactness is required, such as currency, where numeric is the documented alternative. Comparing two floating-point values for exact equality is also inherently fragile, since two calculations that are mathematically equivalent can end up differing in their last few bits.',
      },
      {
        title: 'char(n), varchar(n), and text',
        body: "PostgreSQL provides three general-purpose string types: character(n), which is padded with blanks up to a fixed declared width; character varying(n), which enforces a maximum length without padding shorter values; and text, PostgreSQL's own string type with no length limit, which most built-in string functions are natively written against. A frequently tested detail is that char(n) carries no speed benefit here the way it might in other database engines — it tends to be the slowest of the three once its extra padding and storage overhead are accounted for, so text or varchar is the generally recommended choice for new schemas. Trailing spaces are ignored when comparing char values but remain meaningful for text and varchar, a mismatch that can produce subtle bugs when the types are mixed.",
      },
      {
        title: 'timestamp vs timestamptz',
        body: "Plain timestamp stores a date and time exactly as entered, with no reference to any time zone, while timestamptz converts any incoming value to UTC at write time — using an explicit offset in the input, or otherwise the session's active time zone setting — and keeps only that UTC instant internally. On output, a timestamptz value is converted from the stored UTC back into whichever zone the requesting session currently has active, so the same underlying instant can display differently to two clients in different zones; the originally supplied zone itself is never retained. Because it normalizes everything to a single absolute point in time, timestamptz is generally the safer default for recording when something happened across systems that might span time zones, while plain timestamp better fits values meant to represent a zone-independent wall-clock reading, like a recurring local appointment.",
      },
      {
        title: 'UUID and Native UUIDv7 Generation',
        body: "The uuid type stores a 128-bit identifier, conventionally written as 32 hex digits split into five hyphenated groups, with PostgreSQL accepting several looser input spellings but always normalizing its own output back to that canonical form. Because a UUID's uniqueness comes from the generating algorithm rather than coordination through a shared counter, UUIDs suit distributed systems where multiple independent nodes need to mint identifiers without talking to each other — unlike a sequence-backed serial or identity column, which is only guaranteed unique within a single database. PostgreSQL can natively generate two of the UUID versions defined by the current UUID standard: the long-standing random UUIDv4, via gen_random_uuid() or uuidv4(), and the newer UUIDv7, via uuidv7(), which is documented as time-ordered because it embeds a Unix timestamp in its leading bits, so UUIDv7 values sort roughly in creation order — a property random UUIDv4 values lack entirely, and one that can noticeably help index locality when UUIDs serve as a primary key.",
      },
    ],
  },
  {
    domain: 'architecture',
    taskStatement: 'Composite & Semi-Structured Data, and NULL Semantics',
    topics: [
      {
        title: 'Arrays: Indexing and Declared Sizes',
        body: 'A column can be declared as an array of nearly any type — base, enum, composite, range, or domain — by appending square brackets to the element type name, and PostgreSQL arrays are one-based by default, so a four-element array runs from index 1 through 4 rather than 0 through 3. Any size or dimension count written into a column declaration is purely documentation for the reader: the implementation does not enforce it, and a column declared with a fixed size will still accept arrays of a different size or dimensionality without complaint. Multidimensional arrays are supported, but every sub-array at a given nesting level must share the same length, or the value is rejected as malformed on input.',
      },
      {
        title: 'Array Slicing',
        body: "Beyond fetching one element, PostgreSQL can slice out a rectangular sub-array by writing a lower and upper bound for one or more dimensions inside the subscript brackets, and once any dimension in a subscript uses that colon notation, every dimension in the subscript is treated as a slice, with a bare number for a dimension read as though it were written from 1 up to that number. This makes it possible to pull, for instance, just the first couple of entries from a stored weekly schedule without unpacking the whole array in application code first. Because arrays can be compared with the ordinary comparison operators whenever their element type is itself comparable, they can also participate directly in ORDER BY and equality checks.",
      },
      {
        title: 'Range Types and Bounds',
        body: "A range type represents a span of values over some orderable subtype — PostgreSQL ships built-in ranges over integers, bigints, numeric, both timestamp variants, and dates — and every non-empty range carries a lower and upper bound, each of which can independently be inclusive or exclusive; text form uses a square bracket for an inclusive end and a parenthesis for an exclusive one. Subtypes with a well-defined notion of the 'next' value, like integer or date, are called discrete, and PostgreSQL's built-in integer and date ranges always normalize to the same inclusive-lower, exclusive-upper form regardless of how the bounds were originally written, so that two ranges covering the same integers compare as identical. Continuous subtypes such as numeric or timestamp have no such well-defined step, so the system leaves their bound style exactly as entered.",
      },
      {
        title: 'Exclusion Constraints',
        body: "A plain UNIQUE constraint doesn't fit range-typed columns well, since the property worth enforcing is usually 'no two rows overlap' rather than 'no two rows hold an identical value,' which is what PostgreSQL's EXCLUDE constraint is for — typically backed by a GiST index, it rejects any inserted or updated row whose range overlaps one already present. This is the standard tool for problems like preventing a double-booked meeting room: a range column paired with an exclusion constraint on the overlap operator will refuse a new row whose span intersects an existing one. Combined with the btree_gist extension, an exclusion constraint can mix a range overlap check with an equality check on an ordinary scalar column, so that, for example, overlapping time spans are only rejected when the room number also matches.",
      },
      {
        title: 'json vs jsonb',
        body: 'PostgreSQL stores JSON two ways: json, which keeps an exact copy of the input text and so preserves whitespace, key ordering, and even duplicate object keys as originally written (functions that process it still only honor the last value for any repeated key); and jsonb, which parses the input into a decomposed binary representation at write time. That up-front parsing makes jsonb marginally slower to insert but noticeably cheaper to query afterward, since processing functions never need to reparse text, and jsonb is also the only one of the two that supports indexing for containment and existence lookups. jsonb discards the formatting details json keeps — dropping insignificant whitespace, collapsing duplicate object keys down to the last one supplied, and reformatting numbers through its own numeric representation — which is why jsonb is the generally recommended default unless an application specifically depends on preserving the original text.',
      },
      {
        title: 'NULL and Three-Valued Logic',
        body: "PostgreSQL's ordinary comparison operators return true, false, or — whenever either side is null — null itself, meaning the outcome is unknown rather than definitively true or false. This is exactly why a filter such as WHERE column = NULL never matches any row, not even one where the column genuinely holds no value: the expression evaluates to unknown, not true. The standard-compliant way to test for nullness is the IS NULL or IS NOT NULL predicate rather than an equality comparison. When two values need to be compared while treating null as an ordinary, comparable value — so a pair of nulls counts as matching each other instead of yielding an unknown result — PostgreSQL offers IS [NOT] DISTINCT FROM, which behaves like the standard inequality and equality operators for non-null inputs but always resolves to a definite true or false even when one or both sides are null.",
      },
    ],
  },
  {
    domain: 'querying',
    taskStatement: 'Combining & Filtering Rows',
    topics: [
      {
        title: 'Join Types: Inner, Outer, and Cross',
        body: 'A joined table combines two source tables according to a join type. CROSS JOIN produces the full Cartesian product — every row of the first table paired with every row of the second, with no condition to satisfy, so an N-row table crossed with an M-row table yields N times M rows. INNER JOIN, the default when a query just says JOIN, keeps only combinations where the join condition is satisfied, discarding any row from either side that finds no partner. The three outer joins start from that same inner join result and then add back the unmatched rows: LEFT OUTER JOIN re-adds every unmatched row from the left table, padding the right-hand columns with null; RIGHT OUTER JOIN does the mirror image for the right table; and FULL OUTER JOIN adds back unmatched rows from both sides at once, so it can produce rows that are entirely null on one side or the other.',
      },
      {
        title: 'USING, ON, and NATURAL: Three Ways to Spell a Join Condition',
        body: "ON takes a general boolean expression, exactly like a WHERE clause, so it can compare columns with any operator or combine several conditions — it's the only form that lets the join condition reference something other than a straightforward column-to-column equality. USING is a shorthand for the common case where both sides use identical names for their join columns: writing USING (a, b) is shorthand for an ON condition that ANDs together equality checks on each named column, and as a bonus it collapses each matched pair into a single output column instead of printing both sides. NATURAL goes a step further and builds that USING list automatically from every column name the two tables happen to share, which makes it noticeably riskier than the other two forms — an unrelated schema change that adds a same-named column to either table silently pulls that column into the join condition, changing the query's results without anyone touching the query itself. USING and ON, by contrast, only combine the columns actually named in the query.",
      },
      {
        title: 'The ON-vs-WHERE Trap in Outer Joins',
        body: "For an inner join it makes no real difference whether a condition sits in ON or in WHERE, but for an outer join it changes the result entirely. A condition written into the ON clause is applied while the join itself is being computed, before any null-padded rows are manufactured for unmatched left-side rows — so a LEFT OUTER JOIN with an extra ON condition on the right-hand table still keeps every left-side row, just with nulls on the right wherever that extra condition wasn't met. A condition on that same right-hand column written into WHERE instead runs afterward, against the already-completed join result, including the null-padded rows — and since a comparison against a genuinely null column evaluates to unknown rather than true, those padded rows get filtered straight back out. The practical effect is that a WHERE-clause filter on the nullable side silently turns what looks like a LEFT OUTER JOIN back into something that behaves exactly like an INNER JOIN, quietly dropping the very unmatched-left-row case the outer join was written to preserve.",
      },
      {
        title: 'EXISTS and the Correlated Subquery',
        body: "EXISTS(subquery) is a boolean test that cares only about whether its subquery returns at least one row, not about what that row contains — the subquery's own output list is essentially irrelevant, which is why a common style writes it as EXISTS(SELECT 1 WHERE ...) rather than selecting real columns. EXISTS subqueries are typically correlated: they reference a column from the enclosing query, so the subquery conceptually re-runs (or is optimized to behave as if it re-runs) once per outer row, testing whether some matching related row exists for that particular outer row. Because the result only depends on row presence, an engine is free to stop scanning the moment it finds one qualifying row rather than exhaustively evaluating the subquery — but this is an optimization license, not a guarantee, so a subquery containing side-effecting expressions should not be written assuming it will (or won't) run to completion.",
      },
      {
        title: 'IN, NOT IN, and the NULL Trap',
        body: "expression IN (subquery) matches if the left-hand expression equals any row the subquery returns, which is exactly the behavior of expression = ANY (subquery). NOT IN looks like its natural opposite but hides a well-known trap: if the subquery's result set contains even one null value, and the left-hand expression doesn't exactly equal any of the subquery's non-null rows, the overall NOT IN result comes back null rather than true — because ordinary SQL Boolean logic treats a comparison against null as unknown, and unknown poisons the whole AND-of-comparisons that NOT IN effectively performs. In a WHERE clause, a null result is treated the same as false, so rows that a person would expect NOT IN to keep quietly vanish from the output. A NOT EXISTS-based correlated subquery sidesteps this entirely, since it only ever tests row presence and never compares directly against a value that could be null, which is why it's generally the safer choice whenever the subquery's column might contain nulls.",
      },
      {
        title: 'ANY/SOME and ALL Against a Subquery',
        body: "expression operator ANY (subquery) applies the given operator between the left-hand expression and every row the subquery returns, and is true as soon as any one of those comparisons is true; SOME is accepted as an exact synonym for ANY. expression operator ALL (subquery) is the opposite quantifier — it's true only if the comparison holds for every row the subquery returns, and, as an edge case, is trivially true whenever the subquery returns no rows at all, since there's nothing to fail the test. Because IN is equivalent to = ANY, and NOT IN is equivalent to <> ALL, both quantified forms inherit the same null-handling behavior described for IN and NOT IN: a null anywhere among the compared values can turn a would-be false result into an unknown one instead.",
      },
    ],
  },
  {
    domain: 'querying',
    taskStatement: 'Reusable Query Blocks: CTEs',
    topics: [
      {
        title: 'WITH as Named, Reusable Query Blocks',
        body: 'A WITH clause, commonly called a common table expression or CTE, lets a query define one or more named auxiliary statements ahead of its main body, each of which behaves like a temporary table that exists only for the duration of that one query. A later CTE in the same WITH clause can reference an earlier one, and the primary statement can reference any of them, which is often the cleanest way to break a deeply nested query — one built from sub-selects feeding into further sub-selects — into a sequence of clearly named, independently readable steps. Anything expressible with nested subqueries can, in principle, also be expressed with a WITH clause, but the named, top-to-bottom structure tends to read far more naturally once a query needs more than one or two levels of nesting. Besides SELECT, a CTE\'s auxiliary statement can itself be an INSERT, UPDATE, DELETE, or MERGE, giving the surrounding statement access to rows affected by a data-modifying step.',
      },
      {
        title: 'WITH RECURSIVE: How the Iteration Actually Runs',
        body: "Adding RECURSIVE to a WITH clause allows a CTE to refer to its own output, which plain SQL otherwise disallows. Writing one out requires a fixed three-part shape: a starting, non-recursive query; a UNION or UNION ALL joining it to a second piece; and that second piece, the recursive term, which is the only part of the CTE allowed to name itself. Despite the recursive phrasing, PostgreSQL evaluates it iteratively: it runs the non-recursive term once to seed a working table, then repeatedly re-runs the recursive term with the current working table substituted in for the self-reference, collecting each round's output into the overall result and replacing the working table with that round's rows, stopping as soon as a round produces no new rows at all. Choosing UNION instead of UNION ALL adds a duplicate-elimination step against all previous output on every round, which can also serve as a crude way to keep a search from looping forever, though it doesn't catch every kind of cycle.",
      },
      {
        title: 'Ordering a Recursive Traversal: SEARCH DEPTH/BREADTH FIRST',
        body: "Nothing about the recursive evaluation algorithm guarantees a particular row order in the output, so a query that wants a genuinely depth-first or breadth-first traversal of, say, a tree needs to compute an explicit ordering column and sort by it. The manual technique carries along an array — typically named path — that gets extended with the current row's identifier on each recursive step, so sorting the final result by that array reproduces depth-first order; tracking a simple integer depth counter instead, and sorting by that, reproduces a breadth-first order. Rather than hand-writing these accumulator columns, a query can append a SEARCH DEPTH FIRST BY column_list SET ordering_column or SEARCH BREADTH FIRST BY column_list SET ordering_column clause directly after the CTE definition, and PostgreSQL expands it internally into essentially the same hand-written path- or depth-tracking logic, adding the named ordering column to the CTE's output automatically.",
      },
      {
        title: 'Preventing Infinite Loops: Cycle Detection',
        body: "A recursive query only terminates once a round of the recursive term produces zero new rows, so any query whose underlying data contains a cycle — a chain of links that eventually loops back on itself — will otherwise run forever. Switching UNION ALL to plain UNION can sometimes break the loop by discarding rows that exactly duplicate an earlier one, but many cycles don't repeat a row in full, only some subset of its columns, so that trick isn't reliable on its own. The general-purpose fix carries along an array of already-visited keys, checks each new row's key against that array with an expression like g.id = ANY(path), and stops recursing down any branch where the check matches. PostgreSQL also offers a built-in CYCLE clause — CYCLE column_list SET cycle_mark_column USING path_column — appended after the CTE body, which is internally rewritten into essentially that same visited-array pattern and adds both a boolean cycle-marker column and a path column to the CTE's output automatically.",
      },
      {
        title: 'CTE Materialization: MATERIALIZED vs NOT MATERIALIZED',
        body: "By default, a non-recursive CTE with no volatile side effects that the parent query references exactly once gets folded directly into the parent query's plan, so the optimizer can push a WHERE restriction from the outer query down into the CTE and, for example, still make use of an index on the underlying table. Once the same CTE is referenced more than once, the default flips: PostgreSQL materializes it, computing it a single time into a temporary result and reusing that result for every reference, since pushing an outer restriction down would otherwise only be valid for one of the multiple uses. The MATERIALIZED and NOT MATERIALIZED keywords override whichever default would otherwise apply — MATERIALIZED forces a single separate computation even for a once-referenced CTE (useful when the CTE calls an expensive or side-effecting function that must run exactly once), while NOT MATERIALIZED forces inlining even across multiple references, at the risk of recomputing the CTE's body once per reference.",
      },
    ],
  },
  {
    domain: 'querying',
    taskStatement: 'Aggregation & Window Analytics',
    topics: [
      {
        title: 'Core Aggregate Functions and Null Handling',
        body: "count, sum, and avg reduce a set of rows down to a single summary value — count counts rows or non-null values, sum totals a numeric column, and avg computes the arithmetic mean — while array_agg and string_agg build a composite result instead of a scalar one: array_agg collects every input value (nulls included) into a single array, and string_agg concatenates text values together using a supplied delimiter between each pair. A detail worth remembering is that these functions don't fall back to a zero-like default when there are no input rows to aggregate: sum over zero rows returns null rather than 0, and array_agg over zero rows returns null rather than an empty array, so code relying on a numeric or array result generally needs to wrap the aggregate in coalesce to supply a sensible default explicitly.",
      },
      {
        title: 'Ordered-Set Aggregates: percentile_cont, percentile_disc, and mode',
        body: 'A small family of aggregates, called ordered-set aggregates, care about the sort order of their input rather than just the unordered set of values, and so are written with a WITHIN GROUP (ORDER BY ...) clause instead of a plain argument list. percentile_cont(fraction) WITHIN GROUP (ORDER BY column) returns the value at the given fractional position in the sorted input, interpolating between adjacent values when the fraction falls between two of them, which makes it suitable for continuous data like measured durations. percentile_disc(fraction) WITHIN GROUP (ORDER BY column) answers the same kind of question but always returns one of the actual input values rather than an interpolated one. mode() WITHIN GROUP (ORDER BY column) returns whichever input value appears most frequently. All three ignore null values in the column they are ordering by.',
      },
      {
        title: 'GROUP BY and HAVING: Filtering Before vs After Aggregation',
        body: "A query with a GROUP BY clause collapses every set of rows sharing the same values in the grouped columns down into one output row per group, which is what makes aggregate functions like sum or count meaningful in the select list — they compute one value per group rather than per original row. Once a query is grouped, any column not named in GROUP BY can only appear in the select list inside an aggregate expression, since there's no single value of that column left to represent an entire group (PostgreSQL relaxes this slightly when grouping by a primary key, since every other column of that table is then functionally determined by the group). WHERE and HAVING look similar but run at different points in the pipeline: WHERE filters individual rows before they're ever grouped, so it cannot reference an aggregate result, while HAVING filters entire groups after grouping and aggregation have already happened, so its conditions are free to reference aggregate expressions like HAVING sum(amount) > 5000.",
      },
      {
        title: 'Window Functions: PARTITION BY, ORDER BY, and Ranking',
        body: "A window function computes a value that relates the current row to a set of other rows, but unlike GROUP BY aggregation it never collapses those rows into one — every original row survives in the output, just with an extra computed column alongside it. The defining syntax is an OVER clause following the function call: PARTITION BY divides the rows into independent groups that the function is computed separately within (omitting it treats the whole result set as one partition), and ORDER BY controls the sequence in which rows are considered within each partition, which matters enormously for order-sensitive functions. row_number() assigns strictly increasing, unique integers within each partition according to that order, even when rows are tied; rank() also numbers by that order but gives tied rows — called peers — the same number and then skips ahead by the tie's size for the next distinct value, leaving gaps; dense_rank() numbers peer groups consecutively with no gaps. lag() and lead() reach back to an earlier row or ahead to a later row within the same partition and return a value from it, defaulting to the immediately adjacent row and to null when no such row exists.",
      },
      {
        title: 'The Default Window Frame: A Running Total, Not a Partition Total',
        body: "Some window functions — notably the plain aggregates used as window functions, like sum() OVER (...) — don't necessarily look at the whole partition; they look at that row's window frame, a sub-range of the partition, and the default frame definition is easy to get wrong. Whenever the OVER clause includes an ORDER BY but no explicit frame clause, the frame quietly defaults to everything beginning at the partition's first row and reaching down to wherever the current row's peer group ends — equivalent to writing RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW — so sum(amount) OVER (ORDER BY sale_date) computes a running, cumulative total up to each row rather than the total for the whole partition. Getting a true partition-wide total instead requires either dropping ORDER BY entirely, so the default frame becomes the whole partition, or keeping ORDER BY but overriding the frame explicitly with ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING.",
      },
      {
        title: 'Window Functions Run Last: Interaction with GROUP BY',
        body: "Window functions are evaluated only after grouping, aggregation, and HAVING filtering have already been applied to a query — so if a query also uses GROUP BY, the rows a window function sees and operates over are the already-collapsed group rows, not the original per-row data from FROM and WHERE. That evaluation order is also exactly why window function calls are only allowed in the select list and in a top-level ORDER BY: they're forbidden inside WHERE, GROUP BY, and HAVING themselves, because those clauses logically run before window functions do and so can't yet reference a value that doesn't exist at that stage of the pipeline. Filtering or grouping by a window function's result therefore has to happen one level up, by wrapping the windowed query in a subquery (or CTE) and applying the WHERE condition against the outer query instead.",
      },
    ],
  },
  {
    domain: 'querying',
    taskStatement: 'Beyond Relational: JSON, Full-Text Search & Upsert',
    topics: [
      {
        title: 'Extracting Values: -> vs ->>',
        body: "-> and ->> both reach into a json or jsonb value one level at a time, but they differ in what they hand back: -> returns the extracted piece still wrapped as json or jsonb, which matters when the result needs to be chained into another -> or ->> call or passed to a function expecting JSON, while ->> returns that same piece converted to plain text, which is generally what's wanted for display or for comparing against an ordinary text value. Both operators accept either an integer, which pulls the nth element out of a JSON array (arrays are indexed from zero here, unlike PostgreSQL's own one-based array type, and a negative integer counts back from the end), or a text key, which pulls a field out of a JSON object. A common pattern chains several -> calls to walk down through nested objects and arrays, finishing with a single ->> at the last step to pull out a plain text (or otherwise typed, via an explicit cast) scalar.",
      },
      {
        title: 'Containment with @> and <@',
        body: 'jsonb (but not the plain json type, since the check works against its parsed, decomposed representation) supports two containment operators: @> asks whether the value on its left contains the value on its right, and <@ is the reverse question, whether the left value is contained within the right one. A jsonb object contains another when every key/value pair of the right-hand object is also present in the left-hand object, and a jsonb array contains another largely on an element-membership basis rather than requiring matching order or position. These operators are what make jsonb columns practically indexable for existence-style queries: a GIN index built over a jsonb column can be used to satisfy a containment query efficiently, letting a predicate like WHERE data @> \'{"status": "active"}\' avoid scanning every row even though the underlying value has no fixed schema.',
      },
      {
        title: 'jsonb_set for Targeted, Non-Destructive Updates',
        body: "jsonb_set(target, path, new_value, create_if_missing) produces a modified copy of a jsonb document with the value at the given path replaced, where path is a text array spelling out the sequence of keys or array indexes to descend through — it doesn't mutate target in place, since PostgreSQL values are immutable, so the result has to be written back to the column through an ordinary UPDATE. The optional fourth argument controls what happens when the path doesn't already exist in the document: left at its default of true, jsonb_set creates the missing key (for an object) or extends the array as needed, while passing false makes the call a no-op — returning the original document unchanged — whenever any part of the path is missing. A related function, jsonb_set_lax, adds explicit control over what a null new_value should do instead of always inserting a literal JSON null, offering options like deleting the key or leaving the target untouched.",
      },
      {
        title: 'tsvector, tsquery, and the @@ Match Operator',
        body: "Full-text search represents a document not as raw text but as a tsvector: a sorted list of normalized lexemes, with duplicate positions merged, produced from the original text by to_tsvector, which case-folds words, strips common suffixes so that related word forms collapse together, and drops stop words that are too common to be useful for searching. A search condition is likewise represented as a tsquery — built by to_tsquery from already-normalized search terms combined with the & (AND), | (OR), ! (NOT), and <-> (FOLLOWED BY, for adjacent-word phrase matching) operators — rather than as plain text. The @@ operator tests whether a tsvector matches a tsquery and returns a plain boolean, so a typical full-text condition looks like a WHERE clause comparing to_tsvector('english', description) against to_tsquery('english', 'error & fatal'), and because both sides go through the same normalization step, a search for error correctly matches a document containing only the word errors.",
      },
      {
        title: 'Indexing Full-Text Search: GIN and Generated Columns',
        body: "A full-text condition on a large table benefits enormously from a GIN index built directly on the tsvector expression being searched, such as CREATE INDEX ... USING GIN (to_tsvector('english', body)); an index like this only gets used by a query written with the identical two-argument, explicitly-configured form of to_tsvector, because the one-argument form depends on a session's default_text_search_config setting, which could vary between the time the index was built and the time a query runs. An alternative that avoids repeating to_tsvector in every query is to add a stored generated column — GENERATED ALWAYS AS (to_tsvector('english', coalesce(body, ''))) STORED — and build the GIN index on that column instead; PostgreSQL then keeps the column automatically in sync with its source text, the tsvector computation only has to happen once per row write rather than once per query, and searches no longer need to spell out the configuration name to line up with the index.",
      },
      {
        title: 'Upsert with ON CONFLICT: DO NOTHING, DO UPDATE, and EXCLUDED',
        body: "Appending ON CONFLICT to an INSERT tells PostgreSQL what to do in place of failing with a duplicate-key or overlapping-range error whenever the row being inserted collides with one already on disk, and the whole operation — commonly called an upsert — is guaranteed atomic: concurrently racing sessions will still end up with either a clean insert or a clean update, never a lost update or a spurious duplicate-key error. ON CONFLICT DO NOTHING simply skips the conflicting row and moves on, optionally scoped to a particular conflict_target (a unique index or constraint) or, if no target is named, applied to a conflict against any usable constraint on the table. ON CONFLICT (target_columns) DO UPDATE SET ... requires naming the conflicting constraint explicitly and can reference the row that was about to be inserted through the special EXCLUDED pseudo-table, so a clause like SET quantity = inventory.quantity + EXCLUDED.quantity can merge the new values into the existing row rather than simply overwriting it.",
      },
    ],
  },
];
