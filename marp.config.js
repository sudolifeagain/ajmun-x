const markdownItKroki = require('@kazumatu981/markdown-it-kroki');

module.exports = {
    html: true,
    engine: ({ marp }) => marp.use(markdownItKroki, {
        entrypoint: 'https://kroki.io',
    }),
};
