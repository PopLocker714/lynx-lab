[English](./public-evidence.md) · [Русский](./public-evidence.ru.md)

# Public evidence and source history

Public history and QA evidence are sanitized derivatives. Physical-device serial
numbers, UDIDs, CoreDevice identifiers, vendor device identifiers and crash-reporter
identifiers have been replaced with explicit `REDACTED_*` labels. Hardware models,
OS versions, observed results and documented limitations are retained.

The vendored research snapshot under `.research/secure-store/tamer4lynx/package/`
is withheld from public history because its original copyright/license notice
could not be verified. Registry metadata, source references and research conclusions
remain available. This snapshot was not part of any Lynx Lab runtime package.
The full saved Apple documentation pages `apple-accessibility.md` and
`apple-keychain.md` in the same research directory are also withheld; official
source URLs and the project's research conclusions remain available.

Hashes recorded inside historical QA results refer to the original private
artifacts, not the sanitized public copies. Public derivatives require their own
manifest; they must not be treated as byte-identical original acceptance evidence.
The maintainer retains a verified private Git bundle and original QA files with
checksums and a private original-to-sanitized mapping. No new device test or release
acceptance is implied by redaction.
