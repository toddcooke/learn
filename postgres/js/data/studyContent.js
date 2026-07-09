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
];
