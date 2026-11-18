---
verified: 2026-11-18
lynx_version: 3.9.0
sparkling_version: 2.1.0-rc.36
status: spec
---

> **English** · [Русский](./THIRD_PARTY_NOTICES.ru.md)

# Secure Store research: third-party notices

The [root MIT license](../../LICENSE) applies to Lynx Lab's original work.
Third-party research snapshots retain their original ownership and licenses;
the root license does not replace those terms. This directory contains research
material, not the runtime dependencies of `@lynx-lab/secure-store`.

## Expo SecureStore

`expo-secure-store.swift` and `expo-aes.kt` are unchanged copies of Expo sources.
Both match commit
[`5a97a546476fd0bea35227b60297ad472f065168`](https://github.com/expo/expo/commit/5a97a546476fd0bea35227b60297ad472f065168)
byte for byte. The original collection recorded a moving `main` URL, not a
commit; this is a subsequently verified matching revision, not a reconstructed
download timestamp.

The upstream MIT notice credits **650 Industries, Inc. (aka Expo),
2015-present**. Its complete, unmodified text is preserved in
[`licenses/expo-MIT.txt`](./licenses/expo-MIT.txt), downloaded from that commit's
[`LICENSE`](https://github.com/expo/expo/blob/5a97a546476fd0bea35227b60297ad472f065168/LICENSE).

## React Native Keychain

`rn-keychain-module.kt` and `rn-keychain-package.json` match commit
[`ff42a81f957a82485f9f9574ad3ccef92f648c93`](https://github.com/oblador/react-native-keychain/commit/ff42a81f957a82485f9f9574ad3ccef92f648c93)
byte for byte. The package metadata identifies version `11.0.0`. The original
collection recorded `master`; the commit above is a verified matching revision.

The upstream MIT notice credits **Joel Arvidsson, 2015**. Its complete,
unmodified text is preserved in
[`licenses/react-native-keychain-MIT.txt`](./licenses/react-native-keychain-MIT.txt),
from that commit's
[`LICENSE`](https://github.com/oblador/react-native-keychain/blob/ff42a81f957a82485f9f9574ad3ccef92f648c93/LICENSE).

## Tamer4Lynx: upstream notice not verified

The published package `@tamer4lynx/tamer-secure-store@0.0.3` declares `MIT` and
author `Nanofuxion` in its metadata. All 20 files of the privately retained
research snapshot matched the published npm archive. No `LICENSE`, `COPYING`
or `NOTICE` file was found in that archive or any of the five commits in the
[upstream repository](https://github.com/tamer4lynx/tamer-secure-store/tree/0fe9b68e4434c90510cc4f371f4a70d2b2d5389c).
The source snapshot contains no copyright notice. The metadata is preserved
as evidence; an original license notice has not been established.

Public exports must exclude `tamer4lynx/package/` until the upstream notice is
verified. Keep the original research copy in the private archive. No copyright
year, notice or replacement license is invented on the author's behalf.
[Registry metadata](./tamer4lynx/registry.json) and
[license provenance](./license-provenance.json) retain the exact npm tarball URL,
version, integrity and hashes for reproduction. Tarball SHA-256:
`c3caaea1a159e552dae4e1fd81a347568acde51c6158e03b15fdfee512d52db2`.

## Other retained material

The original notices shipped with the other package snapshots are already
preserved in [`amritk/package/LICENSE`](./amritk/package/LICENSE) and
[`sigx/package/LICENSE`](./sigx/package/LICENSE). They are not replaced here.
The full Apple documentation snapshots `apple-accessibility.md` and
`apple-keychain.md` are excluded from public exports. Keep their originals in
the private research archive; retain their source URLs and hashes in
[`sources.json`](./sources.json) and [`license-provenance.json`](./license-provenance.json),
along with Lynx Lab's own research conclusions. These third-party documents
are not covered by Lynx Lab's MIT license.

Exact source URLs, matching revisions and license SHA-256 values are recorded
in [`license-provenance.json`](./license-provenance.json). The original
[`sources.json`](./sources.json) and code bytes remain unchanged.
