from setuptools import setup, find_packages
from pathlib import Path


ROOT = Path(__file__).parent
README = (ROOT / "README.md").read_text(encoding="utf-8")

setup(
    name="reson",
    version="1.0.0",
    description="Research Engine for Speech & Observation Notes",
    long_description=README,
    long_description_content_type="text/markdown",
    author="MWS AI",
    license="MIT",
    python_requires=">=3.11",
    packages=find_packages(exclude=("tests", "docs")),
    include_package_data=True,
    package_data={
        "reson": [
            "resources/**/*",
            "reporting/common/gunzip_sync.js",
        ]
    },
    install_requires=[
        "pandas>=2.0",
        "numpy>=1.23",
        "scikit-learn>=1.2",
        "typer>=0.9",
        "rich>=13",
        "jinja2>=3",
        "plotly>=5",
        "seaborn>=0.13",
        "matplotlib>=3.7",
        "statsmodels>=0.14",
        "nbformat>=5.8",
        "omegaconf>=2.3",
        "jiwer>=3.0",
        "tqdm>=4.66.1",
    ],
    extras_require={
        "dev": [
            "pytest>=8.0",
            "pytest-cov>=5.0",
        ],
    },
    entry_points={"console_scripts": ["reson=reson.cli:main"]},
    zip_safe=False,
)
