// Keep the routes and parameter values identical to docs/api.md.
export function ApiReference() {
  return (
    <section>
      <h2 className="page-title">API reference</h2>
      <p className="page-desc">
        JSON HTTP API on port 80. Optional Bearer auth when an access token is configured. Test
        routes are POST only. <code>GET /auth</code> is always public.
      </p>
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>Path</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>GET</td>
            <td>
              <code>/</code>
            </td>
            <td>Web control panel</td>
          </tr>
          <tr>
            <td>GET</td>
            <td>
              <code>/animations</code>
            </td>
            <td>Animations page</td>
          </tr>
          <tr>
            <td>GET</td>
            <td>
              <code>/tests</code>
            </td>
            <td>Hardware tests page</td>
          </tr>
          <tr>
            <td>GET</td>
            <td>
              <code>/servo</code>
            </td>
            <td>Servo control page</td>
          </tr>
          <tr>
            <td>GET</td>
            <td>
              <code>/config</code>
            </td>
            <td>Config page</td>
          </tr>
          <tr>
            <td>GET</td>
            <td>
              <code>/api</code>
            </td>
            <td>This API reference</td>
          </tr>
          <tr>
            <td>GET</td>
            <td>
              <code>/auth</code>
            </td>
            <td>Whether API auth is required (always public)</td>
          </tr>
          <tr>
            <td>GET</td>
            <td>
              <code>/health</code>
            </td>
            <td>Health JSON, no side effects</td>
          </tr>
          <tr>
            <td>GET</td>
            <td>
              <code>/settings</code>
            </td>
            <td>Persistent settings</td>
          </tr>
          <tr>
            <td>POST</td>
            <td>
              <code>/settings</code>
            </td>
            <td>Update settings (see parameters below)</td>
          </tr>
          <tr>
            <td>POST</td>
            <td>
              <code>/settings/reset</code>
            </td>
            <td>Factory reset all settings to defaults</td>
          </tr>
          <tr>
            <td>PUT</td>
            <td>
              <code>/settings/wifi</code>
            </td>
            <td>Replace the saved WiFi networks (JSON body)</td>
          </tr>
          <tr>
            <td>GET</td>
            <td>
              <code>/anim</code>
            </td>
            <td>Current animation name</td>
          </tr>
          <tr>
            <td>POST</td>
            <td>
              <code>/anim</code>
            </td>
            <td>Set animation (see parameters below)</td>
          </tr>
          <tr>
            <td>POST</td>
            <td>
              <code>/play</code>
            </td>
            <td>Stream a WAV while an animation runs (see parameters below)</td>
          </tr>
          <tr>
            <td>POST</td>
            <td>
              <code>/test/audio</code>
            </td>
            <td>Play tone test</td>
          </tr>
          <tr>
            <td>POST</td>
            <td>
              <code>/test/audio/bell</code>
            </td>
            <td>Play bell WAV from LittleFS</td>
          </tr>
          <tr>
            <td>POST</td>
            <td>
              <code>/test/screen</code>
            </td>
            <td>OLED demo</td>
          </tr>
          <tr>
            <td>POST</td>
            <td>
              <code>/test/movement</code>
            </td>
            <td>All servos exercise</td>
          </tr>
          <tr>
            <td>POST</td>
            <td>
              <code>/test/led</code>
            </td>
            <td>RGB LED cycle</td>
          </tr>
          <tr>
            <td>POST</td>
            <td>
              <code>/test/servo</code>
            </td>
            <td>Move one servo (see parameters below)</td>
          </tr>
          <tr>
            <td>POST</td>
            <td>
              <code>/setup/servo</code>
            </td>
            <td>Setup AP only: slow 0&ndash;180&deg; move (see parameters below)</td>
          </tr>
          <tr>
            <td>POST</td>
            <td>
              <code>/setup/led</code>
            </td>
            <td>Setup AP only: light logical RGB or one WS2812 wire byte (see parameters below)</td>
          </tr>
          <tr>
            <td>POST</td>
            <td>
              <code>/setup/audio</code>
            </td>
            <td>Setup AP only: play welcome.wav from LittleFS</td>
          </tr>
          <tr>
            <td>POST</td>
            <td>
              <code>/setup/oled</code>
            </td>
            <td>Setup AP only: preview OLED 180&deg; rotation (see parameters below)</td>
          </tr>
        </tbody>
      </table>
      <p>
        POST <code>/settings</code> &mdash; query params (at least one required):
      </p>
      <table>
        <thead>
          <tr>
            <th>Param</th>
            <th>Type</th>
            <th>Range</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>sleep_timeout</code>
            </td>
            <td>integer</td>
            <td>1&ndash;1440 minutes (positive)</td>
          </tr>
          <tr>
            <td>
              <code>hostname</code>
            </td>
            <td>string</td>
            <td>1&ndash;31 chars, letters/digits/hyphen</td>
          </tr>
          <tr>
            <td>
              <code>volume</code>
            </td>
            <td>integer</td>
            <td>0&ndash;100 percent (speaker gain)</td>
          </tr>
          <tr>
            <td>
              <code>welcome</code>
            </td>
            <td>integer</td>
            <td>0 or 1 (boot welcome animation)</td>
          </tr>
          <tr>
            <td>
              <code>serial_log</code>
            </td>
            <td>integer</td>
            <td>0 or 1 (USB serial debug logging)</td>
          </tr>
          <tr>
            <td>
              <code>continuous_timeout</code>
            </td>
            <td>integer</td>
            <td>1&ndash;1440 minutes</td>
          </tr>
          <tr>
            <td>
              <code>loading</code>
            </td>
            <td>string</td>
            <td>
              <code>progress</code> or <code>sleep_inertia</code> (boot screen; next reboot)
            </td>
          </tr>
          <tr>
            <td>
              <code>eyes_style</code>
            </td>
            <td>string</td>
            <td>
              <code>classic</code>, <code>kaomoji</code>, <code>cover</code>, or <code>dots</code>{" "}
              (OLED eyes look; immediate)
            </td>
          </tr>
          <tr>
            <td>
              <code>access_token</code>
            </td>
            <td>string</td>
            <td>0&ndash;64 printable ASCII; empty clears (disables auth)</td>
          </tr>
          <tr>
            <td>
              <code>servo_mins</code>
            </td>
            <td>string</td>
            <td>
              5 comma-separated ints 0&ndash;180; setup AP only; requires <code>servo_maxs</code>
            </td>
          </tr>
          <tr>
            <td>
              <code>servo_maxs</code>
            </td>
            <td>string</td>
            <td>5 comma-separated ints 0&ndash;180; setup AP only; each max &gt; min</td>
          </tr>
          <tr>
            <td>
              <code>rgb_order</code>
            </td>
            <td>string</td>
            <td>
              <code>RGB</code>, <code>RBG</code>, <code>GRB</code>, <code>GBR</code>,{" "}
              <code>BRG</code>, or <code>BGR</code>; setup AP only; default <code>GRB</code>
            </td>
          </tr>
          <tr>
            <td>
              <code>oled_rotate_180</code>
            </td>
            <td>integer</td>
            <td>
              <code>0</code> or <code>1</code>; setup AP only; default <code>0</code>
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        Servo min/max, RGB LED mapping, and OLED rotation can only be set in setup AP mode.{" "}
        <code>PUT /settings/wifi</code> takes a JSON array of 1&ndash;5{" "}
        <code>{'{"ssid", "password"}'}</code> objects; leave out <code>password</code> to keep a
        saved one. In setup AP mode the robot tests the first network before saving. During setup
        (credentials not saved), control APIs return <strong>503</strong>{" "}
        <code>wifi not configured</code>; <code>POST /setup/servo</code>,{" "}
        <code>POST /setup/led</code>, <code>POST /setup/audio</code>, and{" "}
        <code>POST /setup/oled</code> stay available. Servo ranges, RGB mapping, and screen rotation
        survive factory reset and can be retuned in the setup wizard.
      </p>
      <p>
        POST <code>/anim</code> &mdash; query param <code>name</code>:
      </p>
      <table>
        <thead>
          <tr>
            <th>Value</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>none</code>
            </td>
            <td>Idle pose</td>
          </tr>
          <tr>
            <td>
              <code>typing</code>
            </td>
            <td>Typing gesture</td>
          </tr>
          <tr>
            <td>
              <code>reading</code>
            </td>
            <td>Reading gesture</td>
          </tr>
          <tr>
            <td>
              <code>thinking</code>
            </td>
            <td>Thinking gesture</td>
          </tr>
          <tr>
            <td>
              <code>talking</code>
            </td>
            <td>
              Speaking gesture; soft torso shifts (audio-reactive during <code>/play</code>)
            </td>
          </tr>
          <tr>
            <td>
              <code>ring</code>
            </td>
            <td>One-shot bell gesture</td>
          </tr>
          <tr>
            <td>
              <code>welcome</code>
            </td>
            <td>One-shot hello gesture</td>
          </tr>
          <tr>
            <td>
              <code>attention</code>
            </td>
            <td>Input-request gesture + audio</td>
          </tr>
          <tr>
            <td>
              <code>error</code>
            </td>
            <td>Obstacle gesture + audio</td>
          </tr>
          <tr>
            <td>
              <code>abort</code>
            </td>
            <td>Abort gesture + audio</td>
          </tr>
          <tr>
            <td>
              <code>dead</code>
            </td>
            <td>Out-of-power: dead.wav, then X X</td>
          </tr>
          <tr>
            <td>
              <code>wakeup</code>
            </td>
            <td>One-shot sleep-inertia wake</td>
          </tr>
          <tr>
            <td>
              <code>sleep</code>
            </td>
            <td>Close eyes and sleep</td>
          </tr>
        </tbody>
      </table>
      <p>
        POST <code>/play</code> or <code>{"/play/{name}"}</code> &mdash; body: 16-bit mono PCM WAV
        at 22050 Hz. <code>name</code> runs while the clip plays:
      </p>
      <table>
        <thead>
          <tr>
            <th>Value</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>talking</code>
            </td>
            <td>Default; motion follows speech energy</td>
          </tr>
          <tr>
            <td>
              <code>typing</code>
            </td>
            <td>Typing gesture</td>
          </tr>
          <tr>
            <td>
              <code>reading</code>
            </td>
            <td>Reading gesture</td>
          </tr>
          <tr>
            <td>
              <code>thinking</code>
            </td>
            <td>Thinking gesture</td>
          </tr>
          <tr>
            <td>
              <code>none</code>
            </td>
            <td>Idle pose</td>
          </tr>
        </tbody>
      </table>
      <p>
        POST <code>/test/servo</code> &mdash; query params:
      </p>
      <table>
        <thead>
          <tr>
            <th>Param</th>
            <th>Type</th>
            <th>Range</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>index</code>
            </td>
            <td>integer</td>
            <td>0&ndash;4</td>
          </tr>
          <tr>
            <td>
              <code>angle</code>
            </td>
            <td>number</td>
            <td>0&ndash;180</td>
          </tr>
        </tbody>
      </table>
      <p>
        POST <code>/setup/servo</code> &mdash; setup AP only, ~25&deg;/s, no safe-range clamp. Query
        params:
      </p>
      <table>
        <thead>
          <tr>
            <th>Param</th>
            <th>Type</th>
            <th>Range</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>all</code>
            </td>
            <td>integer</td>
            <td>
              <code>90</code> (move every joint to 90&deg;)
            </td>
          </tr>
          <tr>
            <td>
              <code>index</code>
            </td>
            <td>integer</td>
            <td>
              0&ndash;4 (required with <code>angle</code> when <code>all</code> is omitted)
            </td>
          </tr>
          <tr>
            <td>
              <code>angle</code>
            </td>
            <td>number</td>
            <td>0&ndash;180</td>
          </tr>
        </tbody>
      </table>
      <p>
        POST <code>/setup/led</code> &mdash; setup AP only, no Wi-Fi gate. Lights a logical color or
        one WS2812 <em>wire</em> byte. Query params:
      </p>
      <table>
        <thead>
          <tr>
            <th>Param</th>
            <th>Type</th>
            <th>Range</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>color</code>
            </td>
            <td>string</td>
            <td>
              <code>R</code>, <code>G</code>, or <code>B</code> (logical; uses saved or{" "}
              <code>rgb_order</code>)
            </td>
          </tr>
          <tr>
            <td>
              <code>rgb_order</code>
            </td>
            <td>string</td>
            <td>
              <code>RGB</code>, <code>RBG</code>, <code>GRB</code>, <code>GBR</code>,{" "}
              <code>BRG</code>, or <code>BGR</code> (optional with <code>color</code>)
            </td>
          </tr>
          <tr>
            <td>
              <code>byte</code>
            </td>
            <td>string</td>
            <td>
              <code>0</code>, <code>1</code>, <code>2</code>, or <code>off</code> (omit or{" "}
              <code>off</code> releases the hold)
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        POST <code>/setup/audio</code> &mdash; setup AP only, no Wi-Fi gate. Plays{" "}
        <code>welcome.wav</code> from LittleFS. No query params.
      </p>
      <p>
        POST <code>/setup/oled</code> &mdash; setup AP only, no Wi-Fi gate. Preview OLED rotation
        and draw <code>THIS WAY UP</code>. Omit <code>rotate_180</code> to restore the provisioning
        screen. Query params:
      </p>
      <table>
        <thead>
          <tr>
            <th>Param</th>
            <th>Type</th>
            <th>Range</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>rotate_180</code>
            </td>
            <td>integer</td>
            <td>
              <code>0</code> or <code>1</code> (omit to restore provisioning text)
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
