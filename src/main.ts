import { GitHub, context } from '@actions/github';
import { getInput, setFailed, debug } from '@actions/core';
import { statSync, createReadStream } from 'fs';
import { sync } from 'glob';

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

	const filepath = sync(path, { absolute: true, nocase: true });
	const file = createReadStream(filepath[0]);

	try {
		await octokit.repos.uploadReleaseAsset({
			url: upload_url,
			file: file,
			name: filepath[0].split('/').slice(-1)[0],
			headers: {
				'content-length': statSync(filepath[0]).size,
				'content-type': contentType
			}
		});
	} catch (error) {
		setFailed(error.message);
	}
}

run();
