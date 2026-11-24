/**
 * Stops the page scrolling under whatever covers it — a sheet, the full-screen picture,
 * action mode — and gives scrolling back when the last of them goes.
 *
 * Counted, never saved and restored. Each holder used to note `body.style.overflow` as
 * it found it and put that back when it closed, which is right only when they close in
 * the reverse of the order they opened. A sheet opening while another was still sliding
 * away (the tab bar's "+" handing over to another page's sheet, the baby log's chooser
 * opening a nappy) noted "hidden", outlived the one that had noted the real value, and
 * put "hidden" back last: the whole app stopped scrolling until it was reloaded.
 */
let holders = 0;

export function lockScroll(): () => void {
  holders += 1;
  if (holders === 1) document.body.style.overflow = "hidden";
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders -= 1;
    if (holders === 0) document.body.style.overflow = "";
  };
}
