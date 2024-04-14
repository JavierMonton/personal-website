import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

const FeatureList = [
  {
    title: 'Blog',
    Svg: require('@site/static/img/blog200.svg').default,
    description: (
      <>
        Programming, technology, and other stuff.
      </>
    ),
  },
  {
    title: 'Open Source',
    Svg: require('@site/static/img/open-source200.svg').default,
    description: (
      <>
        Open Source projects I'm working on.
      </>
    ),
  },
];

function Feature({Svg, title, description}) {
  return (
    <div className={clsx('col col--6')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
