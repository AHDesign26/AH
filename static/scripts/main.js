// let postCategory = {};

// fetch('https://admin.ahdesign.website/api/categories')
// .then((response) => response.json())
// .then(data => {
//     let category=document.querySelector('#id');
//     postCategory = data
    
// })


// fetch('https://admin.ahdesign.website/api/posts')
//     .then((response) => response.json())
//     .then(data => {
//         let container=document.querySelector('[data-layout="masonry"]');
//         let cards = "";
//         data.map(post => {
//         cards += `  <div class=" grid-item filter-design">

//                         <article class="vlt-post vlt-post--style-4">
//                             <div class="vlt-post__media">
//                                 <a class="vlt-post__link" href="/post/${post.slug}">
//                                 </a>
//                                 <img src="https://admin.ahdesign.website/media/${post.thumbnail}" alt="" loading="lazy">
//                             </div>
//                             <div class="vlt-post__content">
//                                 <header class="vlt-post__header">
//                                     <div class="vlt-post-meta">
//                                         <span>${new Date(post.published_date).toLocaleString('en-Uk', {
//                                                                                             day: 'numeric', 
//                                                                                             year: 'numeric', 
//                                                                                             month: 'long', 
//                                                                                             })}
//                                         </span>
                                        
//                                         <span style="color: #e82e31;">
//                                             ${postCategory.filter(object => object.id === post.category_id)[0].title}
//                                         </span>
//                                     </div>
//                                     <h3 class="vlt-post-title">
//                                         <a href="/post/${post.slug}">${post.title}</a>
//                                     </h3>
//                                 </header>
//                                 <div class="vlt-post-excerpt">
//                                     <p class="text-justify">
//                                         ${post.brief}
//                                     </p>
//                                 </div>
//                             </div>
//                         </article>
//                     </div> `


//         container.innerHTML += cards;
//     }
//     )
// }
// )

// // getting slug
// let address = document.URL
// let slug = address.split('/').slice(-1) 

// let author = [];
// fetch('https://admin.ahdesign.website/api/authors')
//     .then((response) => { response.json() })
//     .then((data) => {
//         author = data
        
//     })

     
// fetch('https://admin.ahdesign.website/api/post/' + slug)
//     .then((response) => { response.json() })
//     .then((data) => {
//         let article = document.querySelector('#mainpost')
//         let post = data[0]
//         let writer = author.filter(writer => writer.id === post.author_id)[0];
//         article.innerHTML += `<article class="vlt-single-post vlt-single-post--style-4" id="mainpost">
//                                 <header class="vlt-single-post__header">
//                                     <h2 class="vlt-post-title">${post.title}</h2>
//                                     <div class="vlt-post-meta">
//                                         <span>${new Date(post.published_date).toLocaleString('en-Uk', {
//                                                 day: 'numeric', 
//                                                 year: 'numeric', 
//                                                 month: 'long', 
//                                             })}
//                                         </span>
//                                         <span>
//                                             ${postCategory.filter(object => object.id === post.category_id)[0].title}
//                                         </span>
//                                     </div>
//                                 </header>
//                                 <div class="vlt-single-post__content">
//                                     <p>${post.body}</p>
//                                     <div class="vlt-gap-70"></div>
            
//                                 </div>
        
//                                 <!--About author-->
//                                 <div class="vlt-about-author">
//                                     <div class="vlt-about-author__avatar">
//                                         <a href="#">
//                                             <img src="https://admin.ahdesign.website/media/${writer.pic}" alt="" loading="lazy">
//                                         </a>
//                                     </div>
//                                     <div class="vlt-about-author__content">
//                                         <h5 class="vlt-about-author__title">
//                                         [{id :1, author:ty}, ]
//                                             ${writer.name}
//                                         </h5>
//                                         <p class="vlt-about-author__text">
//                                            ${writer.description}
//                                         </p>
//                                     </div>
//                                 </div>
//                             </article>`
//     })