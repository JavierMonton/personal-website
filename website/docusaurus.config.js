// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Personal website',
  tagline: 'Programming, technology, and other stuff.',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://javier.monton.info',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'JavierMonton', // Usually your GitHub org/user name.
  projectName: 'personal-website', // Usually your repo name.
  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        gtag: {
          trackingID: 'G-02W5S6K82N',
        },
        /*
        docs: {
          sidebarPath: './sidebars.js',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/',
        },

         */
        blog: {
          showReadingTime: true,
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/JavierMonton/blog/edit/main/website',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: 'img/docusaurus-social-card.jpg',
      navbar: {
        title: 'Home',
        logo: {
          alt: 'My Site Logo',
          src: 'img/wheel1.svg',
        },
        items: [
          /*
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Tutorial',
          },
          */
          {to: '/cv', label: 'CV', position: 'left'},
          {to: '/blog', label: 'Blog', position: 'left'},
          {
            href: 'https://github.com/JavierMonton/blog',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Blog',
            items: [
              {
                label: 'Blog',
                to: '/blog',
              },
            ],
          },
          {
            title: 'About me',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/JavierMonton',
              },
              {
                label: 'Stack Overflow',
                href: 'https://stackoverflow.com/users/7041871/javier-mont%c3%b3n',
              },
              {
                label: 'LinkedIn',
                href: 'https://www.linkedin.com/in/javiermonton/',
              },
              {
                label: 'CV',
                href: '/cv',
              },
              {
                label: 'Twitter',
                href: 'https://twitter.com/javier_monton',
              },
            ],
          },
          {
            title: 'Open Source / Projects',
            items: [
              {
                label: 'Blog',
                to: '/blog',
              },
              {
                label: 'Big-Data-Types',
                href: 'https://data-tools.github.io/big-data-types/',
              },
              {
                label: 'Milpartituras.com',
                href: 'https://milpartituras.com',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()}. Built with Docusaurus.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['java', 'scala', 'kotlin'],
      },
    }),
};

export default config;
