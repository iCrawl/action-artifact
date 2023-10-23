import { createReadStream, statSync } from 'node:fs';
import process from 'node:process';
import { debug, getInput, setFailed } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { create } from '@actions/glob';

const { GITHUB_TOKEN } = process.env;

type ReleasePayload = {
	release: {
		id: number;
	};
};

declare global {
	namespace NodeJS {
		// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
		interface ProcessEnv {
			GITHUB_TOKEN: string;
		}
	}
}

async function run() {
	const path = getInput('path', { required: true });
	const contentType = getInput('content-type', { required: true });
	const tagFromInput = getInput('release-tag', { required: false });

	const octokit = getOctokit(GITHUB_TOKEN);
	debug(`Commit: ${context.sha}`);

	const { owner, repo } = context.repo;

	let release_id: number;

	if (tagFromInput) {
		const response = await octokit.rest.repos.getReleaseByTag({ owner, repo, tag: tagFromInput });

		if (response.status !== 200) {
			setFailed(`Failed to get release by tag: ${response.status}`);
			process.exit(1);
		}

		release_id = response.data.id;
	} else {
		release_id = (context.payload as ReleasePayload).release.id;
	}

	let upload_url;
	try {
		({
			data: { upload_url },
		} = await octokit.rest.repos.getRelease({ owner, repo, release_id }));
	} catch (error) {
		setFailed(error as string);
		return;
	}

	const globber = await create(path);
	for await (const filepath of globber.globGenerator()) {
		const file = createReadStream(filepath);

		try {
			await octokit.rest.repos.uploadReleaseAsset({
				owner,
				repo,
				release_id,
				url: upload_url,
				data: file as any,
				name: process.platform === 'win32' ? filepath.split('\\').slice(-1)[0] : filepath.split('/').slice(-1)[0],
				headers: {
					'content-length': statSync(filepath).size,
					'content-type': contentType,
				},
			});
		} catch (error) {
			setFailed(error as string);
		}
	}
}

void run();
