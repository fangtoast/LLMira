/**
 * @project LLMira
 * @file scripts/configure-android-signing.mjs
 * @author fangtoast <fangtoast@foxmail.com>
 * @date 2026-08-13
 * @description Configure the generated Tauri Android project without storing signing secrets in Git.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const androidProject = path.resolve(
  process.env.LLMIRA_ANDROID_PROJECT_DIR ?? "src-tauri/gen/android",
);
const gradlePath = path.join(androidProject, "app", "build.gradle.kts");
const propertiesPath = path.join(androidProject, "keystore.properties");

const requiredEnvironment = [
  "LLMIRA_ANDROID_KEYSTORE_FILE",
  "LLMIRA_ANDROID_KEYSTORE_PASSWORD",
  "LLMIRA_ANDROID_KEY_ALIAS",
  "LLMIRA_ANDROID_KEY_PASSWORD",
];

for (const name of requiredEnvironment) {
  if (!process.env[name]) throw new Error(`${name} is required.`);
}

function escapeProperty(value) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r")
    .replaceAll("=", "\\=")
    .replaceAll(":", "\\:");
}

const keystoreFile = path.resolve(process.env.LLMIRA_ANDROID_KEYSTORE_FILE)
  .replaceAll("\\", "/");
const properties = [
  `password=${escapeProperty(process.env.LLMIRA_ANDROID_KEYSTORE_PASSWORD)}`,
  `keyPassword=${escapeProperty(process.env.LLMIRA_ANDROID_KEY_PASSWORD)}`,
  `keyAlias=${escapeProperty(process.env.LLMIRA_ANDROID_KEY_ALIAS)}`,
  `storeFile=${escapeProperty(keystoreFile)}`,
  "",
].join("\n");

await writeFile(propertiesPath, properties, { encoding: "utf8", mode: 0o600 });

let gradle = await readFile(gradlePath, "utf8");
for (const importLine of [
  "import java.io.FileInputStream",
  "import java.util.Properties",
]) {
  if (!gradle.includes(importLine)) gradle = `${importLine}\n${gradle}`;
}

if (!gradle.includes('create("release")')) {
  const buildTypes = gradle.match(/^(\s*)buildTypes\s*\{/m);
  if (!buildTypes) throw new Error("Android buildTypes block was not found.");
  const indent = buildTypes[1];
  const inner = `${indent}    `;
  const signingBlock = [
    `${indent}signingConfigs {`,
    `${inner}create("release") {`,
    `${inner}    val keystorePropertiesFile = rootProject.file("keystore.properties")`,
    `${inner}    val keystoreProperties = Properties()`,
    `${inner}    keystoreProperties.load(FileInputStream(keystorePropertiesFile))`,
    `${inner}    keyAlias = keystoreProperties["keyAlias"] as String`,
    `${inner}    keyPassword = keystoreProperties["keyPassword"] as String`,
    `${inner}    storeFile = file(keystoreProperties["storeFile"] as String)`,
    `${inner}    storePassword = keystoreProperties["password"] as String`,
    `${inner}}`,
    `${indent}}`,
    "",
  ].join("\n");
  gradle = gradle.replace(buildTypes[0], `${signingBlock}${buildTypes[0]}`);
}

if (!gradle.includes('signingConfig = signingConfigs.getByName("release")')) {
  const releaseBlock = /(\s*(?:getByName\("release"\)|release)\s*\{\s*\n)/;
  if (!releaseBlock.test(gradle)) throw new Error("Android release build block was not found.");
  gradle = gradle.replace(
    releaseBlock,
    `$1                signingConfig = signingConfigs.getByName("release")\n`,
  );
}

await writeFile(gradlePath, gradle, "utf8");
console.log("Android signing configuration prepared.");
