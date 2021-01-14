import { Octokit } from '@octokit/core';

type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;

const octokit = new Octokit({
  auth: `token ${process.env.GH_TOKEN}`,
});

const getRepositories = async (page = 1): Promise<[string, string][]> => {
  const repositories = (await octokit.request(
    'GET /user/repos',
    {
      per_page: 100,
      page,
    }
  )).data
    .filter((repo) => !repo.fork)
    .map((repo) => repo.full_name.split('/') as [string, string]);

  return [
    ...repositories,
    ...(repositories.length === 0 ? [] : await getRepositories(page + 1)),
  ];
};

const getAllLanguages = (data: ThenArg<ReturnType<typeof getRepositories>>) => (
  Promise.all(data.map(async ([owner, repo]) => (
    await octokit.request('GET /repos/{owner}/{repo}/languages', { owner, repo })
  ).data))
);

const getAllLanguageStat = (data: ThenArg<ReturnType<typeof getAllLanguages>>) => (
  data.reduce((prevData, curr) => ({
    ...prevData,
    ...(Object.keys(curr).reduce((prev, key) => ({
      ...prev,
      [key]: prev[key] ? prev[key] + curr[key] : curr[key],
    }), {})),
  }))
);

const getMainLanguageStat = (data: ThenArg<ReturnType<typeof getAllLanguages>>) => (
  data
    .filter((e) => Object.keys(e).length !== 0)
    .map((languages) => (
      Object.keys(languages).reduce((a, b) => languages[a] > languages[b] ? a : b)
    ))
    .reduce((prev, curr) => ({
      ...prev,
      [curr]: (prev[curr] || 0) + 1,
    }), {})
);

const toPercent = (data: Record<string, number>) => {
  const sum = Object.values(data).reduce((a, b) => a + b);
  return (
    Object.keys(data)
      .reduce((prev, curr) => ({
        ...prev,
        [curr]: data[curr] / sum * 100,
      }), {})
  );
};

const sortRecord = (data: Record<string, number>) => (
  Object.entries(data).sort(([, a], [, b]) => b - a)
);

(async () => {
  const repositories = await getRepositories();
  const languages = await getAllLanguages(repositories);
  const stat = getAllLanguageStat(languages);
  const percent = toPercent(stat);
  const percentSorted = sortRecord(percent);
  console.log(percentSorted);
})();