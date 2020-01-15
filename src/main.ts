import { debug, getInput, setFailed } from '@actions/core';
import { context, GitHub } from '@actions/github';
import { create } from '@actions/glob';
import { createReadStream, statSync } from 'fs';

const { GITHUB_TOKEN } = process.env;

async function run() {
	const path = getInput('path', { required: true });
	const contentType = getInput('content-type', { required: true });

	const octokit = new GitHub(GITHUB_TOKEN!);
	debug(`Commit: ${context.sha}`);

	const { owner, repo } = context.repo;
	const release_id = context.payload.release.id;
	let upload_url;
	try {
		({ data: { upload_url } } = await octokit.repos.getRelease({ owner, repo, release_id }));
	} catch (error) {
		return setFailed(error.message);
	}

	const globber = await create(path);
	for await (const filepath of globber.globGenerator()) {
		const file = createReadStream(filepath);

		try {
			await octokit.repos.uploadReleaseAsset({
				url: upload_url,
				file: file,
				name: filepath.split('/').slice(-1)[0],
				headers: {
					'content-length': statSync(filepath).size,
					'content-type': contentType
				}
			});
		} catch (error) {
			setFailed(error.message);
		}
	}
}

run();
