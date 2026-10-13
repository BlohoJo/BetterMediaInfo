# BetterMediaInfo (BlohoJo fork)

[![Windows Build](https://github.com/BlohoJo/BetterMediaInfo/actions/workflows/windows_build.yml/badge.svg)](https://github.com/BlohoJo/BetterMediaInfo/actions/workflows/windows_build.yml) [![Linux Build](https://github.com/BlohoJo/BetterMediaInfo/actions/workflows/linux_build.yml/badge.svg)](https://github.com/BlohoJo/BetterMediaInfo/actions/workflows/linux_build.yml) [![MacOS Build](https://github.com/BlohoJo/BetterMediaInfo/actions/workflows/macos_build.yml/badge.svg)](https://github.com/BlohoJo/BetterMediaInfo/actions/workflows/macos_build.yml)

> This is a **fork** of [caoccao/BetterMediaInfo](https://github.com/caoccao/BetterMediaInfo)
> maintained by [BlohoJo](https://github.com/BlohoJo). It focuses on the List view, on stability
> when loading large batches of files, and on remembering the way you set the List view up.
> See [Fork changes](#fork-changes) for everything that differs from upstream. The built-in
> update check points at this fork's releases only, so the application will never auto-update
> back to the upstream build.

![BetterMediaInfo](src-tauri/icons/128x128@2x.png)

BetterMediaInfo is a better GUI for [MediaInfo](https://github.com/MediaArea/MediaInfo). Why? Because I'm not a fan of the official MediaInfo GUI.

BetterMediaInfo is built on top of [MediaInfoLib](https://github.com/MediaArea/MediaInfoLib).

## Features

* Linux (x86_64) + MacOS (x86_64 + arm64) + Windows (x86_64)
* Drag and drop
* Multiple files / directories
* Real-time filter
* First class duration, stream size, bit rate, scan type
* Precise duration
* Integrate with [BatchMkvExtract](https://github.com/caoccao/BatchMkvExtract)
* Integrate with [BDMaster](https://github.com/caoccao/BDMaster)

![Screenshot](https://github.com/caoccao/BetterMediaInfo/raw/main/docs/screenshots/card_view.png)

## Fork changes

Everything below is specific to this fork.

### Stability: MediaInfo.dll is no longer called concurrently

Adding a folder of ~100 files could crash the application with
`EXCEPTION_ACCESS_VIOLATION (0xC0000005)` inside `MediaInfo.dll`, or leave the window blank and
unresponsive. Two independent problems caused that:

1. **The backend called the native library from several threads at once.** `MediaInfo.dll` keeps
   process wide state that is shared by every handle, so parallel `MediaInfo_Open` /
   `MediaInfo_Get` / `MediaInfo_Delete` calls make it read memory another thread is freeing.
   * A global mutex (`media_info::lock_media_info`) now serializes **every** access to the
     native library: `get_properties`, `get_stream_count`, `get_about` and the one-off parameter
     list that is read on start up.
   * Those calls were also running directly on the async runtime, where a slow file blocked a
     runtime worker. They now run on `tokio::task::spawn_blocking`, so the UI stays responsive
     while a file is being parsed.
   * `MediaInfoFile::try_new` replaces the panicking `MediaInfoFile::new` in the command path. A
     corrupt or unreadable file now returns an error for that single file instead of unwinding
     through the command thread (which also poisoned the lock and aborted the whole batch).
2. **The frontend fired one IPC call per file on every store update.** Each answer updated the
   store, which re-ran the effect for every file again: the number of in-flight MediaInfo calls
   grew quadratically with the number of files. Loading is now done by a pool of **4 workers**
   with in-flight / failed bookkeeping, so a file is requested exactly once and at most four
   files are parsed at a time - the same "10 at a time" pattern that was stable when adding
   files manually. Template columns use the same pool size.

Errors raised while a batch is loading are reported **once per batch** instead of once per file.

### List view

* **Sticky headings and a sticky horizontal scroll bar.** The grid now scrolls internally
  instead of growing with its content (`autoHeight` was removed), so the column headings stay on
  top and the horizontal scroll bar stays at the bottom of the viewport while scrolling a long
  list.
* **Template columns.** Every property offered by `Settings -> Templates` (General, Video, Audio,
  Text, Other, Image, Menu) is available as an extra column. They are listed after the default
  columns and hidden by default; the full property set of a file is loaded lazily, and only while
  at least one template column is visible.
* **Reordering.** Columns can be moved with the up/down buttons next to every entry in
  *Manage columns*.
  > **Limitation:** reordering columns by dragging the column headings is a **MUI X Pro** feature
  > (`disableColumnReorder` is forced on in the Community DataGrid this project uses), so it
  > cannot be enabled here. The up/down buttons are the supported way to change the order.
* **Checked columns stay on top.** *Manage columns* lists the columns in display order. Checking a
  column moves it right behind the last visible column, so the default columns come first and the
  columns you added follow in the order you added them. Unchecking a column leaves it exactly
  where it is, which makes it easy to check again.
* **Reset Order / Reset All.** *Reset Order* puts the columns back into the default order (default
  columns first, then the checked template columns in their original template order) and keeps
  your selection. *Reset All* restores the default columns, the default order and the default
  widths.
* **Auto size all column headings.** Right clicking a column heading opens the column menu, which
  now has an *Auto size all column headings* entry. It resizes every column to the wider of its
  heading and its widest value, including the padding - exactly what double clicking a single
  column separator does, applied to all columns at once.
* **The List view is remembered.** Column visibility, column order and column widths are written
  to the application configuration (debounced) and restored on the next start up. Widths that you
  set yourself (by dragging a separator, by double clicking it, or through *Auto size all column
  headings*) are never overwritten by the automatic auto-sizing; only columns you have not sized
  are auto-sized when the rows change.
* **Show/Hide All** starts unchecked and asks for confirmation before showing every column at
  once, because the template list can contain hundreds of them. The *Manage columns* list is
  virtualized, so a very long list stays responsive.

### About page

* "Author" is now labelled **Original Author** and still points at
  [Sam Cao](https://github.com/caoccao).
* A **Fork** entry ([BlohoJo](https://github.com/BlohoJo)) and a **Fork GitHub** entry
  ([BlohoJo/BetterMediaInfo](https://github.com/BlohoJo/BetterMediaInfo)) were added underneath,
  mirroring the original Author / GitHub cards.

### Updates

* `Settings -> Update -> Check interval` has a new **Never** option that disables the automatic
  check completely; *Check for updates* still works on demand.
* The update check and the "new version available" link now use
  `https://github.com/BlohoJo/BetterMediaInfo/releases`, so this build can never offer the
  upstream version as an update.

### Configuration

The new state lives under `view.list` in the configuration file:

```json
{
  "view": {
    "list": {
      "columnVisibility": { "Video:FrameCount": true },
      "columnOrder": ["General:CompleteName", "Video:FrameCount"],
      "columnWidths": { "General:CompleteName": 420 }
    }
  }
}
```

All three entries are optional; missing fields fall back to the List view defaults.

### Test material

`test_videos/` contains 101 small videos (about 1 GB in total) with long file names and special
characters, used to reproduce the crash and to check stability.

## Documentation

* [Installation](docs/installation.md)
* [Screenshots](docs/screenshots.md)
* [Development](docs/development.md)
* [Release Notes](docs/release_notes.md)
* [TODOs](docs/todos.md)

## Blog

* [BetterMediaInfo — A Better GUI for MediaInfo](https://blog.caoccao.com/bettermediainfo-a-better-gui-for-mediainfo-fcd227962002)

## Credits

* Original author: [Sam Cao](https://github.com/caoccao) - [caoccao/BetterMediaInfo](https://github.com/caoccao/BetterMediaInfo)
* Fork: [BlohoJo](https://github.com/BlohoJo) - [BlohoJo/BetterMediaInfo](https://github.com/BlohoJo/BetterMediaInfo)
* Built on top of [MediaInfoLib](https://github.com/MediaArea/MediaInfoLib)

## License

[APACHE LICENSE, VERSION 2.0](LICENSE)
