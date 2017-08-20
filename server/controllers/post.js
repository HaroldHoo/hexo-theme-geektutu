import {Post, Tag} from '../models'
import {POSTS_BASE_PATH} from '../config/'
import fs from 'fs'
import shell from 'shelljs'

let tagNames2TagIds = async(tagNames) => {
  let tags = []
  // 去重
  let _tagNames = tagNames.filter((item, pos) => tagNames.indexOf(item) === pos)
  // 外键引用
  for (let i = 0; i < _tagNames.length; i++) {
    let name = _tagNames[i]
    if (name.length === 24) {
      tags.push(name)
      continue
    }
    let tag = (await Tag.findOne({name})) || (await new Tag({name}).save())
    tags.push(tag._id)
  }

  return tags
}


export default {
  'GET /posts': async(ctx, next) => {
    let groupBy = ctx.query.groupBy
    let data

    console.log(`get posts group by ${groupBy}`)
    switch (groupBy) {
      case 'date':
        data = await Post.aggregate([
          {$match: {isArticle: true}},
          {
            $group: {
              _id: {month: {$month: "$createdAt"}, year: {$year: "$createdAt"}},
              posts: {$push: {_id: "$_id", title: "$title", slug: "$slug"}}
            }
          }])
        data.forEach(item => {
          item.date = item._id
          delete item._id
        })
        break
      case 'category':
        data = await Post.aggregate([
          {$match: {isArticle: true}},
          {
            $group: {
              _id: '$category',
              posts: {$push: {_id: "$_id", title: "$title", slug: "$slug"}}
            }
          }
        ])
        data.forEach(item => {
          item.category = item._id
          delete item._id
        })
        break
      case 'tag':
        data = await Post.aggregate([
          {$match: {isArticle: true}},
          {$unwind: '$tags'},
          {
            $group: {
              _id: '$tags',
              posts: {$push: {_id: "$_id", title: "$title", slug: "$slug"}}
            }
          }
        ])
        data.forEach(item => {
          item.tag = item._id
          delete item._id
        })
        data = await Tag.populate(data, {path: 'tag'})
        break
      default:
        data = await Post.find({isArticle: true}).populate('tags')
    }
    ctx.response.body = {
      'data': data
    };
  },
  'GET /posts/tags/:id': async(ctx, next) => {
    ctx.response.body = {
      'data': await Post.find({tags: {$in: [ctx.params.id]}}).populate('tags')
    };
  },
  'GET /posts/:slug': async(ctx, next) => {
    let slug = ctx.params.slug;
    let post = await Post.findOne({slug}).populate('tags')
    if (post && post._id && post.isArticle) {
      let fields = {title: 1, slug: 1}
      let tags = []
      post.tags.forEach(item => tags.push(item._id))
      post._doc.related = await Post.find({tags: {$in: tags}, _id: {$ne: post._id}, isArticle: true}, fields)
    }
    ctx.response.body = {
      'data': post
    };
  },
  'GET /admin/posts': async(ctx, next) => {
    await Tag.remove().exec()
    await Post.remove().exec()

    let manifest = JSON.parse(fs.readFileSync(POSTS_BASE_PATH + '/manifest.json'));
    let records = []
    Object.keys(manifest).forEach((category) => {
       manifest[category].forEach((meta) => {
         let content = fs.readFileSync(POSTS_BASE_PATH + '/' + meta.path, 'utf-8')
         let record = {
           slug: meta.path.split('/').reverse()[0].replace('.md', '.html'),
           content: content,
           tags: meta.tags.split(','),
           isArticle: meta.isArticle || meta.isArticle === undefined,
           canComment: meta.canComment || meta.canComment === undefined,
           category: category
         }
         shell.cd(POSTS_BASE_PATH)
         let log = shell.exec('git log --follow --format="%cd" -- ' + meta.path, {silent:true}).stdout.trim()
         let dates = log.split('\n')

         console.log(meta.path)
         console.log(dates)

         record.updatedAt = new Date(dates[0])
         record.createdAt = new Date(dates.reverse()[0])
         record.title = content.substr(0, content.indexOf('\n')).replace('#', '').trim()
         records.push(record)
      })
    })

    let needRecords = records.filter((item) => item.isArticle).sort((o1, o2) => {
      return o1.createdAt - o2.createdAt
    })

    needRecords.forEach((item, index, arr) => {
      let _pre = arr[index - 1]
      let _next = arr[index + 1]
      item.previous = arr[index - 1] === undefined ? null : {
        slug: _pre.slug,
        title: _pre.title
      }
      item.next = arr[index + 1] === undefined ? null : {
        slug: _next.slug,
        title: _next.title
      }
    })

    for(let i = 0; i < records.length; i++) {
      let item = records[i]
      try {
        item.tags = await tagNames2TagIds(item.tags)
        let post = new Post(item)
        console.log('then save...')
        await post.save()
      } catch (e) {
        console.log(e.message)
      }
    }
  }
}