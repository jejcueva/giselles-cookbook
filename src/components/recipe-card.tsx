import Image from "next/image";
import Link from "next/link";

type Category = {
  id: string;
  name: string;
};

type RecipeCardProps = {
  id: string;
  title: string;
  coverImageUrl: string | null;
  categories?: Category[];
  maxCategories?: number;
};

export function RecipeCard({ id, title, coverImageUrl, categories = [], maxCategories }: RecipeCardProps) {
  const displayCategories = maxCategories ? categories.slice(0, maxCategories) : categories;

  return (
    <Link
      href={`/recipes/${id}`}
      className="recipe-card recipe-card-vertical"
      style={{ textDecoration: "none" }}
    >
      {coverImageUrl ? (
        <Image
          src={coverImageUrl}
          alt={title}
          className="recipe-card-img"
          width={640}
          height={360}
          unoptimized
        />
      ) : (
        <div className="recipe-card-img recipe-card-img-placeholder">
          <div className="recipe-card-img-placeholder-bar" />
          <div className="recipe-card-img-placeholder-bar recipe-card-img-placeholder-bar-secondary" />
        </div>
      )}
      <div className="recipe-info recipe-info-card">
        <span className="recipe-name">{title}</span>
        {displayCategories.length > 0 && (
          <div className="recipe-card-tags">
            {displayCategories.map((category) => (
              <span key={category.id} className="recipe-category-chip">
                {category.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
