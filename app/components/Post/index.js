import React from "react";
import {Link} from 'react-router-dom'
import PropTypes from 'prop-types'
import {connect} from 'react-redux'
import actions from '../../actions'
import {bindActionCreators} from 'redux'

import styles from './style.css'
import CSSModules from 'react-css-modules'

const getPost = actions.getPost
const addPost = actions.addPost
const mapStateToProps = (state) => ({post: state.post})
const mapDispatchToProps = (dispatch) => ({
  actions: bindActionCreators({
    getPost, addPost
  }, dispatch)
})

@connect(mapStateToProps, mapDispatchToProps)
@CSSModules(styles)
class Post extends React.Component {
  constructor(props) {
    super(props);
  }

  static propTypes = {
    post: PropTypes.object.isRequired,
    actions: PropTypes.object.isRequired,
  };

  static fetchData(store) {
    return store.dispatch(actions.getPost())
  }

  fetchPost() {
    var {match, post, actions} = this.props
    var slug = match.params.slug
    if (post && post.slug !== slug) {
      actions.getPost(slug);
    }
  }

  componentDidUpdate() {
    this.fetchPost()
  }

  componentDidMount() {
    this.fetchPost()
  }

  render() {
    var post = this.props.post || {}
    var tags = post.tags || []
    var related = post.related || []
    var pre = post.previous || {}
    var next = post.next || {}
    return (
        <div className="col-xs-12">
          <div dangerouslySetInnerHTML={{__html: post.htmlContent}}/>
          <hr/>
          <p><span>标签：</span>{tags.map(item => (<code key={item._id} styleName="label">{item.name}</code>))}</p>
          <p>本站使用 <a href="https://creativecommons.org/licenses/by/4.0/deed.zh">署名 4.0 国际</a> 创作共享协议，转载请注明出处</p>
          {related.length > 0 && <h3>相关文章</h3> }
          <ul>{related.map(item => (<li key={item._id}><Link to={'/post/' + item.slug}>{item.title}</Link></li>))}</ul>
          <hr/>
          <div>
            {pre._id && <Link className="float-left" to={'/post/' + pre.slug}>« {pre.title}</Link>}
            {next._id && <Link className="float-right" to={'/post/' + next.slug}>{next.title} »</Link>}
          </div>

        </div>
    )
  }
}
export default Post