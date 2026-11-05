#!/usr/bin/env node
// Packs the built game (../dist) into an installable Android APK with Capacitor.
// Needs: Node, JDK 21 and the Android SDK (ANDROID_HOME). Run "npm run build" in the repo root first.
// Output: mobile/Blockspell-android.apk
//
// The APK is signed with mobile/blockspell-sideload.keystore. That key is public on purpose: this APK is for
// installing by hand ("sideloading"), it is not a Play Store build, and using one fixed key means a newer APK
// installs over an older one instead of failing with a signature mismatch.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: here, stdio: 'inherit', shell: process.platform === 'win32', ...opts });

if (!fs.existsSync(path.join(here, '..', 'dist', 'index.html'))) throw new Error('../dist is missing. Run "npm run build" in the repo root first.');
if (!process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT) throw new Error('ANDROID_HOME is not set (Android SDK needed).');

// fresh native project every time: nothing generated is committed
fs.rmSync(path.join(here, 'android'), { recursive: true, force: true });
run('npx', ['cap', 'add', 'android']);

// our icons, splash colour and full-screen theme replace Capacitor's defaults
const res = path.join(here, 'android', 'app', 'src', 'main', 'res');
for (const d of fs.readdirSync(res)) if (/^drawable(-(land|port))?(-[a-z]*dpi)?$/.test(d)) fs.rmSync(path.join(res, d, 'splash.png'), { force: true });
fs.cpSync(path.join(here, 'android-res'), res, { recursive: true });
fs.rmSync(path.join(res, 'drawable', 'ic_launcher_background.xml'), { force: true }); // replaced by the colour in values/
fs.rmSync(path.join(res, 'drawable-v24', 'ic_launcher_foreground.xml'), { force: true });

run('npx', ['cap', 'sync', 'android']);

// the fixed sideload key doubles as the debug key, so assembleDebug signs with it
const androidDir = path.join(os.homedir(), '.android');
fs.mkdirSync(androidDir, { recursive: true });
fs.copyFileSync(path.join(here, 'blockspell-sideload.keystore'), path.join(androidDir, 'debug.keystore'));

const gradlew = path.join(here, 'android', process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
if (process.platform !== 'win32') fs.chmodSync(gradlew, 0o755);
run(gradlew, ['--no-daemon', 'assembleDebug'], { cwd: path.join(here, 'android') });

const apk = path.join(here, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
if (!fs.existsSync(apk)) throw new Error('Gradle finished but no APK was produced.');
fs.copyFileSync(apk, path.join(here, 'Blockspell-android.apk'));
console.log('\nbuilt', path.join(here, 'Blockspell-android.apk'), `(${(fs.statSync(apk).size / 1e6).toFixed(1)} MB)`);
