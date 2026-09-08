# Flash

`/flash.html` installs the committed merged M5 firmware from
`public/firmware/m5-controller/` through esp-web-tools. `src/ui/flash.html`
declares the custom element, setup form and log and links `src/ui/app.css`.
Flash remains scrollable and respects the library's Shadow DOM and dialogs.

`flash.page.ts` binds inputs, displays connection/send states and keeps a bounded
log. Form reads are pure; explicit persistence saves only SSID/device ID and
removes legacy stored passwords, including malformed records. The password is
cleared on page cleanup and is never logged or stored.

`src/entry/flash.entry.ts` owns connection attempts, command dispatch and page
exit. It prevents concurrent open/send attempts and closes a port returned after
page exit. `src/m5/setup/serial-setup.ts` owns the port, reader/writer and awaited
close. The protocol defines typed responses and fixed notices; raw serial output
and arbitrary device messages do not reach the log. A write confirms only that
bytes were sent; `configureResult.ok` confirms applied configuration.

Flash creates no Experience Run. Building/exporting firmware remains documented
in [firmware/m5](../../../firmware/m5/README.md).
