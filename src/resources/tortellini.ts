import { ReturnObject } from "../getdata";
import * as artifact from "@actions/artifact";
import * as fs from "fs";
import * as path from "path";
import YAML from "yaml";

// Because the unit tests can't access Github tokens, all artifact-related types are
// replaced with types that can be replaced with mock objects
export type Artifact = typeof artifact | TestArtifact;
export type ArtClient = artifact.ArtifactClient | TestClient;
export type DownloadResponse = artifact.DownloadResponse | TestResponse;
export type DownloadOptions = artifact.DownloadOptions | undefined;

export interface TestArtifact {
    create: () => TestClient;
}

export type DLArtFunc = (
    name: string,
    path?: string | undefined,
    options?: DownloadOptions
) => TestResponse;

export interface TestResponse {
    artifactName: string;
    downloadPath: string | undefined;
}

export interface TestClient {
    downloadArtifact: (
        name: string,
        path?: string,
        options?: DownloadOptions
    ) => TestResponse;
}

export async function runTortellini(
    artifactObject?: Artifact
): Promise<ReturnObject> {
    // An artifact object is only passed in the unit test. If that is the case,
    // set the download destination to the unit test output folder.
    // If not, use the regular Github Action artifact, and the normal output folder
    let destination: string = "";
    if (artifactObject !== undefined) {
        destination = ".tortellini-unit-test";
    } else {
        artifactObject = artifact;
        destination = ".tortellini-artifact";
    }

    const downloadResponse = await getArtifactData(
        "tortellini-result",
        destination,
        artifactObject
    );

    const fileContents = await getFileFromArtifact(
        downloadResponse,
        "evaluation-result.yml"
    );

    const obj = YAML.parse(fileContents);

    const filteredData = await filterData(obj);

    return {
        ReturnName: "Tortellini",
        ReturnData: filteredData,
    };
}

// Download the artifact that was uploaded by Tortellini
export async function getArtifactData(
    artifactName: string,
    destination: string,
    artifactObject: Artifact
): Promise<DownloadResponse> {
    const artifactClient = artifactObject.create();
    const downloadResponse = await artifactClient.downloadArtifact(
        artifactName,
        destination
    );

    return downloadResponse;
}

// Get a file from the artifact as a string
export async function getFileFromArtifact(
    dlResponse: DownloadResponse,
    fileName: string
): Promise<string> {
    let filePath: string = "";
    if (dlResponse.downloadPath === undefined) filePath = fileName;
    else filePath = path.join(dlResponse.downloadPath, fileName);
    const buffer = fs.readFileSync(filePath);

    return buffer.toString();
}

// Only get the data that is relevant for license checking
// To make sure all properties are always present,
// replace undefined properties with a dash
export async function filterData(obj: any): Promise<any> {
    // Project data
    const project = obj.analyzer.result.projects[0];
    const projData = {
        id: project.id || "-",
        licenses: project.declared_licenses || "-",
        description: project.description || "-",
        authors: project.authors || "-",
        vcs: project.vcs_processed || "-",
    };

    // Package data
    const packages = obj.analyzer.result.packages;
    const packData = [];
    for (const pack of packages) {
        const p = {
            id: pack.package.id || "-",
            licenses: pack.package.declared_licenses || "-",
            description: pack.package.description || "-",
            authors: pack.package.authors || "-",
            vcs: pack.package.vcs_processed || "-",
        };
        packData.push(p);
    }

    // Violations
    const viol = obj.evaluator.violations;

    return { project: projData, packages: packData, violations: viol };
}
